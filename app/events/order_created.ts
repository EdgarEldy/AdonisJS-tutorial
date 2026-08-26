/**
 * Fired once an order row has actually been persisted. Carries only the
 * two ids a listener needs to react (send a notification, log an audit
 * entry, and so on) without forcing every listener to re-fetch or receive
 * the full Order model, matching the README's own code sample for this
 * event exactly.
 */
export default class OrderCreated {
  constructor(
    public orderId: number,
    public customerId: number
  ) {}
}
