import { AMQPMessageReceiver } from "./AMQPMessageReceiver";
import { AMQPMessageSender, UUIDGenerator } from "./AMQPMessageSender";
import { MessagingSystem } from "../MessagingSystem";
import { Message } from "../Message";
import { Channel, Connection } from "amqplib";
import { MessageHandler } from "../MessageHandler";
const amqp = require('amqplib');

export class AMQPMessagingSystem implements MessagingSystem {
    private connectionPromise: Promise<void>;
    private messageReceiver?: AMQPMessageReceiver;
    private messageSender?: AMQPMessageSender;

    constructor(
        connectionOptions: any,
        private messageIdGenerator: UUIDGenerator,
        private outExchanges: string[],
        private inputExchange: string,
        private inputQueue = ''
    ) {
        this.connectionPromise = amqp.connect(connectionOptions)
            .then((conn: Connection) => {
                return conn.createChannel();
            }).then((channel: Channel) => {
                if (!this.inputQueue) {
                    return channel.assertQueue('', { durable: false, autoDelete: true })
                        .then((response) => this.createSenderAndReceiver(channel, response.queue));
                } else {
                    this.createSenderAndReceiver(channel, inputQueue);
                }
            }).then(() => undefined);
    }
    
    private createSenderAndReceiver(channel: Channel, inputQueue: string) {
        this.inputQueue = inputQueue;
        this.messageReceiver = new AMQPMessageReceiver(channel, this.inputExchange, inputQueue);
        this.messageSender = new AMQPMessageSender(channel, this.outExchanges, this.messageIdGenerator);
    }

    private getMessageReceiver(): Promise<AMQPMessageReceiver> {
        return this.connectionPromise.then(() => this.messageReceiver!);
    }

    private getMessageSender(): Promise<AMQPMessageSender> {
        return this.connectionPromise.then(() => this.messageSender!);
    }

    async send(message: Message, registrationKey?: string | undefined): Promise<void> {
        return this.getMessageSender()
            .then((sender) => sender.send(message, registrationKey));
    }

    on(messageNamePattern: string, handler: MessageHandler, registrationKey?: string | undefined): void {
        this.getMessageReceiver()
            .then((receiver) => receiver.on(messageNamePattern, handler, registrationKey));
    }

    startAcceptingMessages(): Promise<void> {
        return this.getMessageReceiver()
            .then((receiver) => receiver.startAcceptingMessages());
    }

}