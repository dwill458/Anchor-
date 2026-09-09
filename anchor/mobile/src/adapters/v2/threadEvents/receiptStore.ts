import AsyncStorage from '@react-native-async-storage/async-storage';
import type { V2ThreadEventChannel } from '@/constants/v2/threadEvents';
import type { V2ThreadEventReceipt } from './types';

const KEY_PREFIX = '@anchor/v2/thread-event-receipt/';
export type V2ReceiptStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

const receiptKey = (eventId: string, channel: V2ThreadEventChannel) => `${KEY_PREFIX}${eventId}/${channel}`;

/** Local cache only. The presentation API remains the cross-device receipt authority. */
export class V2ThreadEventReceiptStore {
  constructor(private readonly storage: V2ReceiptStorage = AsyncStorage) {}

  async read(eventId: string, channel: V2ThreadEventChannel): Promise<V2ThreadEventReceipt | null> {
    const raw = await this.storage.getItem(receiptKey(eventId, channel));
    if (!raw) return null;
    try { return JSON.parse(raw) as V2ThreadEventReceipt; } catch { return null; }
  }

  async write(receipt: V2ThreadEventReceipt): Promise<void> {
    await this.storage.setItem(receiptKey(receipt.eventId, receipt.channel), JSON.stringify(receipt));
  }

  async isTerminal(eventId: string, channel: V2ThreadEventChannel): Promise<boolean> {
    const receipt = await this.read(eventId, channel);
    return receipt?.status === 'ACKNOWLEDGED' || receipt?.status === 'DISMISSED';
  }
}
