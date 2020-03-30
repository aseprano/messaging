import { MessageSender } from "../MessageSender";
import { Message } from "../Message";

export abstract class AbstractMessageSender implements MessageSender {
    abstract send(message: Message, registrationKey?: string | undefined): Promise<void>;
}
