import { Provider, constants, provider, RpcProvider, GetTransactionReceiptResponse, ReceiptTx } from "starknet";

// Function to decode token transfer events
export async function decodeTokenTransferEvents(tx: GetTransactionReceiptResponse) {
  try {
    // Get transaction receipt
    const txReceipt: GetTransactionReceiptResponse = tx;

    console.log('txReceipt', txReceipt)
    // Extract events from the receipt

    if (!txReceipt.events) {
      return [];
    }

    const events = txReceipt.events;

    console.log('events', events)
    
    // Filter for transfer events (for ERC20 tokens)
    // ERC20 Transfer event has a specific key
    const transferEvents = events.filter((event: any) => {
      // The first element in the keys array is the event name hash
      // For ERC20 Transfer, it's the hash of "Transfer(address,address,uint256)"
      return event.keys[0] === "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";
    });
    
    // Decode each transfer event
    const decodedEvents = transferEvents.map((event: any) => {

        if (event.data.length < 3) {
            return null;
        }

      return {
        token: event.fromAddress,
        from: '0x' + BigInt(event.data[0]).toString(16),
        to: '0x' + BigInt(event.data[1]).toString(16),
        value: BigInt(event.data[2]).toString()
      };
    });

    console.log('decodedEvents', decodedEvents)
    
    return decodedEvents;
  } catch (error) {
    console.error("Error decoding events:", error);
    throw error;
  }
}