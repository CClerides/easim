import { test, expect, type Page } from '@playwright/test'

/**
 * The four journeys the submission has to answer for.
 *
 * Each test is the click-by-click recipe from the README, executed. If the
 * README ever drifts from what the site does, these fail.
 *
 * They sign in with the demo button, because that is the route a reviewer will
 * take — Supabase's free mailer is rate limited and cannot be relied on.
 */

type Scenario = 'approve' | 'decline' | 'timeout' | 'provider_failure'

async function signInAsCustomer(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in as customer' }).click()
  await page.waitForURL('**/plans')
}

async function signInAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in as admin' }).click()
  await page.waitForURL('**/admin')
}

async function signOut(page: Page) {
  const signOutButton = page.getByRole('button', { name: 'Sign out' })
  if (await signOutButton.isVisible().catch(() => false)) {
    await signOutButton.click()
  }
}

/** Buy one plan with a chosen payment outcome. Returns the order URL. */
async function placeOrder(page: Page, slug: string, scenario: Scenario): Promise<string> {
  await page.goto(`/plans/${slug}`)
  await page.getByRole('button', { name: 'Add to cart' }).click()

  await page.goto('/checkout')
  await page.locator(`input[name="scenario"][value="${scenario}"]`).check()
  await page.getByRole('button', { name: /Place order/ }).click()

  await page.waitForURL('**/orders/**')
  return page.url()
}

test.describe('placing an order', () => {
  test('a customer buys a plan and receives an eSIM', async ({ page }) => {
    await signInAsCustomer(page)
    await placeOrder(page, 'japan-10gb-30d', 'approve')

    // The page updates itself when the provider's callback lands — no reload.
    await expect(page.getByText('eSIM delivered')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Your eSIM/ })).toBeVisible({
      timeout: 30_000,
    })

    // A real credential, not a placeholder.
    await expect(page.getByText(/^8944\d{15}$/)).toBeVisible()
    await expect(page.getByText(/^LPA:1\$/)).toBeVisible()
    await expect(page.getByAltText(/Activation QR code/)).toBeVisible()

    // And it is in the account afterwards.
    await page.goto('/account')
    await expect(page.getByRole('heading', { name: 'Your eSIMs' })).toBeVisible()
    await expect(page.getByText(/^8944\d{15}$/).first()).toBeVisible()
  })

  test('the cart is emptied once the order is placed', async ({ page }) => {
    await signInAsCustomer(page)
    await placeOrder(page, 'global-20gb-30d', 'approve')

    await page.goto('/cart')
    await expect(page.getByText('Your cart is empty')).toBeVisible()
  })
})

test.describe('the three failure paths', () => {
  test('a declined payment charges nothing and issues nothing', async ({ page }) => {
    await signInAsCustomer(page)
    await placeOrder(page, 'mexico-5gb-30d', 'decline')

    await expect(page.getByText(/payment was declined/i)).toBeVisible({ timeout: 30_000 })
    // No eSIM section at all.
    await expect(page.getByRole('heading', { name: /Your eSIM/ })).toHaveCount(0)
  })

  test('a provider that never responds times the order out on its own', async ({ page }) => {
    // The deadline alone is 90s, plus a poll interval and the clicking before
    // it. The default test timeout would expire mid-wait.
    test.setTimeout(240_000)

    await signInAsCustomer(page)
    await placeOrder(page, 'turkey-10gb-15d', 'timeout')

    await expect(page.getByText(/Waiting for the payment provider/)).toBeVisible()

    // Nothing is scheduled anywhere. The page polls, the server reconciles the
    // order against its deadline on read, and the state changes. Ninety
    // seconds plus room for the poll interval.
    await expect(page.getByText(/never responded/i)).toBeVisible({ timeout: 150_000 })
    await expect(page.getByRole('heading', { name: /Your eSIM/ })).toHaveCount(0)
  })

  test('a paid order survives a provider outage and an admin rescues it', async ({ page }) => {
    test.setTimeout(240_000)

    await signInAsCustomer(page)
    const orderUrl = await placeOrder(page, 'thailand-8gb-15d', 'provider_failure')

    // Payment succeeded, delivery did not — and the order is explicitly safe.
    await expect(page.getByText(/payment went through/i)).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/your order is safe/i)).toBeVisible()
    await expect(page.getByText(/provider_503/)).toBeVisible()

    // The customer's money is accounted for even though nothing was delivered.
    await expect(page.getByText('Total paid')).toBeVisible()

    await signOut(page)
    await signInAsAdmin(page)

    // It is waiting in the admin's default view, which shows only what needs
    // a human.
    await expect(page.getByText(/could not be delivered/)).toBeVisible()
    await page.getByRole('button', { name: 'Retry delivery' }).first().click()

    // Confirmation arrives as a banner, not as text under the button: a
    // successful retry removes the row, which would unmount the button.
    await expect(page.getByText(/has been\s+fulfilled/)).toBeVisible({ timeout: 60_000 })

    // And the customer now has their eSIM on the very same order.
    await signOut(page)
    await signInAsCustomer(page)
    await page.goto(orderUrl)
    await expect(page.getByText('eSIM delivered')).toBeVisible()
    await expect(page.getByText(/^8944\d{15}$/)).toBeVisible()
  })
})

test.describe('what must not be possible', () => {
  test('no card field exists anywhere in checkout', async ({ page }) => {
    await signInAsCustomer(page)
    await page.goto('/plans/uae-5gb-7d')
    await page.getByRole('button', { name: 'Add to cart' }).click()
    await page.goto('/checkout')

    // The brief forbids real card data anywhere, including a mock checkout.
    const inputs = page.locator('input')
    const count = await inputs.count()

    for (let i = 0; i < count; i++) {
      const attributes = await inputs.nth(i).evaluate((element) => ({
        name: element.getAttribute('name') ?? '',
        type: element.getAttribute('type') ?? '',
        autocomplete: element.getAttribute('autocomplete') ?? '',
      }))

      const haystack = `${attributes.name} ${attributes.autocomplete}`.toLowerCase()
      expect(haystack).not.toMatch(/card|cvc|cvv|expiry|exp-|security-code|pan/)
    }
  })

  test('a signed-out visitor cannot reach private pages', async ({ page, context }) => {
    await context.clearCookies()

    for (const path of ['/account', '/checkout', '/admin']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('a customer cannot reach the admin view', async ({ page }) => {
    await signInAsCustomer(page)
    await page.goto('/admin')

    // Redirected home rather than shown a "forbidden" page, which would
    // confirm that /admin exists.
    await expect(page).not.toHaveURL(/\/admin/)
    await expect(page.getByRole('heading', { name: 'Orders' })).toHaveCount(0)
  })
})
