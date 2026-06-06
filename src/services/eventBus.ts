import { EventEmitter } from 'events'

export type AppEvent =
  | { type: 'transaction.created'; transactionId: number }
  | { type: 'transaction.deleted'; transactionId: number }
  | { type: 'rate.updated'; rate: number }
  | { type: 'webhook.message.created'; messageId: number }
  | { type: 'webhook.message.updated'; messageId: number }

class AppEventBus extends EventEmitter {}
export const eventBus = new AppEventBus()
eventBus.setMaxListeners(200)

export function emit(event: AppEvent): void {
  eventBus.emit('event', event)
}
