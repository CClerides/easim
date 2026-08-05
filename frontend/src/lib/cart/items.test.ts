import { describe, it, expect } from 'vitest'
import { addItem, removeItem, setQty, parseCart, MAX_QTY_PER_PLAN } from './items'

const A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301' // genuine v4
const B = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' // genuine v4

describe('addItem', () => {
  it('appends a plan that is not in the cart', () => {
    expect(addItem([], A)).toEqual([{ planId: A, qty: 1 }])
  })

  it('increments a plan already in the cart rather than duplicating it', () => {
    expect(addItem([{ planId: A, qty: 1 }], A)).toEqual([{ planId: A, qty: 2 }])
  })

  it('keeps other plans untouched', () => {
    expect(addItem([{ planId: A, qty: 1 }], B)).toEqual([
      { planId: A, qty: 1 },
      { planId: B, qty: 1 },
    ])
  })

  it('caps quantity so a stuck button cannot order ninety eSIMs', () => {
    const full = [{ planId: A, qty: MAX_QTY_PER_PLAN }]
    expect(addItem(full, A)).toEqual(full)
  })

  it('does not mutate the array it was given', () => {
    const original = [{ planId: A, qty: 1 }]
    addItem(original, A)
    expect(original).toEqual([{ planId: A, qty: 1 }])
  })
})

describe('setQty', () => {
  it('replaces the quantity', () => {
    expect(setQty([{ planId: A, qty: 1 }], A, 3)).toEqual([{ planId: A, qty: 3 }])
  })

  it('removes the line when set to zero', () => {
    expect(setQty([{ planId: A, qty: 2 }], A, 0)).toEqual([])
  })

  it('removes the line when set negative', () => {
    expect(setQty([{ planId: A, qty: 2 }], A, -1)).toEqual([])
  })

  it('clamps to the maximum', () => {
    expect(setQty([{ planId: A, qty: 1 }], A, 999)).toEqual([
      { planId: A, qty: MAX_QTY_PER_PLAN },
    ])
  })
})

describe('removeItem', () => {
  it('drops only the named plan', () => {
    expect(
      removeItem(
        [
          { planId: A, qty: 1 },
          { planId: B, qty: 2 },
        ],
        A,
      ),
    ).toEqual([{ planId: B, qty: 2 }])
  })
})

/**
 * localStorage is writable by anyone with devtools open, so whatever comes
 * back is untrusted input and gets validated like any other.
 */
describe('parseCart', () => {
  it('accepts a well-formed cart', () => {
    expect(parseCart('[{"planId":"' + A + '","qty":2}]')).toEqual([{ planId: A, qty: 2 }])
  })

  it('returns an empty cart for nothing stored', () => {
    expect(parseCart(null)).toEqual([])
  })

  it('returns an empty cart rather than throwing on broken JSON', () => {
    expect(parseCart('{not json')).toEqual([])
  })

  it('rejects a payload of the wrong shape', () => {
    expect(parseCart('{"planId":"x"}')).toEqual([])
    expect(parseCart('[{"planId":123,"qty":"two"}]')).toEqual([])
  })

  it('rejects a planId that is not a uuid, so a forged id never reaches the server', () => {
    expect(parseCart('[{"planId":"../../etc/passwd","qty":1}]')).toEqual([])
    // A shape-correct but non-RFC uuid is rejected too.
    expect(parseCart('[{"planId":"11111111-1111-1111-1111-111111111111","qty":1}]')).toEqual([])
  })

  it('rejects a hand-edited absurd quantity', () => {
    expect(parseCart('[{"planId":"' + A + '","qty":100000}]')).toEqual([])
  })

  it('rejects a negative quantity', () => {
    expect(parseCart('[{"planId":"' + A + '","qty":-5}]')).toEqual([])
  })
})
