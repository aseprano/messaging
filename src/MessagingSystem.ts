import { MessageSender } from "./MessageSender";
import { MessageReceiver } from "./MessageReceiver";

export interface MessagingSystem extends MessageSender, MessageReceiver {
}
