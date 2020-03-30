import { MessageHandler } from "./MessageHandler";

export interface MessageReceiver {
    /**
     * @param namePattern The pattern of the message name.
     *   The '*' symbol can be used to match any character sequence
     *   The '?' symbol can be used to match a single word
     * @param handler A callback function that the incoming messages are passed to
     * @param registrationKey The registration key to filter incoming messages.
     *   If left undefined, any message will will be accepted.
     *   If defined, only messages with the same registration key will be accepted.
     */
    on(namePattern: string, handler: MessageHandler, registrationKey?: string): void;
}
