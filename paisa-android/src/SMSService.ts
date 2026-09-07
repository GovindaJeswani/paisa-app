/**
 * Native SMS Reading Service
 *
 * Uses react-native-get-sms-android to read SMS from the device.
 * Filters for bank transaction messages and parses them.
 */

import SmsAndroid from "react-native-get-sms-android";
import { parseSMS, isBankSMS, type ParsedSMS } from "./sms-parser";

export interface SMSMessage {
  _id: number;
  address: string;
  body: string;
  date: number;
  read: number;
  type: number; // 1 = inbox
}

/**
 * Read all SMS from the last N days and filter for bank transactions
 */
export function readBankSMS(daysBack: number = 7): Promise<ParsedSMS[]> {
  return new Promise((resolve, reject) => {
    const minDate = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const filter = {
      box: "inbox",
      minDate: minDate,
      maxCount: 500,
    };

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: string) => {
        console.log("[Paisa SMS] Failed to read SMS:", fail);
        reject(new Error(fail));
      },
      (_count: number, smsList: string) => {
        try {
          const messages: SMSMessage[] = JSON.parse(smsList);
          const bankMessages = messages
            .filter((msg) => isBankSMS(msg.body))
            .map((msg) => parseSMS(msg.body))
            .filter((parsed): parsed is ParsedSMS => parsed !== null);

          console.log(
            `[Paisa SMS] Read ${messages.length} messages, found ${bankMessages.length} bank transactions`
          );
          resolve(bankMessages);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

/**
 * Read SMS since a specific timestamp (for incremental sync)
 */
export function readNewSMS(sinceTimestamp: number): Promise<ParsedSMS[]> {
  return new Promise((resolve, reject) => {
    const filter = {
      box: "inbox",
      minDate: sinceTimestamp,
      maxCount: 100,
    };

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: string) => reject(new Error(fail)),
      (_count: number, smsList: string) => {
        try {
          const messages: SMSMessage[] = JSON.parse(smsList);
          const bankMessages = messages
            .filter((msg) => isBankSMS(msg.body))
            .map((msg) => parseSMS(msg.body))
            .filter((parsed): parsed is ParsedSMS => parsed !== null);
          resolve(bankMessages);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}
