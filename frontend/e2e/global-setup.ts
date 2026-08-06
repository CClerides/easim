/**
 * Records when the run began, so the teardown can tell the orders this suite
 * created from any that already existed.
 */
export default async function globalSetup() {
  process.env.E2E_STARTED_AT = new Date().toISOString()
}
