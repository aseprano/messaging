import { Message } from "./Message";

export interface MessageSender {
    send(message: Message, registrationKey?: string): Promise<void>;
}
