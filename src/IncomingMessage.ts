import { Message } from "./Message";

export interface IncomingMessage extends Message {
    id: string,
    registrationKey: string
}
