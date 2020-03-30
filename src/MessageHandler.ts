import { IncomingMessage } from "./IncomingMessage";

export type MessageHandler = (message: IncomingMessage) => void;
