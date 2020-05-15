import { AMQPMessageReceiver } from "./AMQPMessageReceiver";
import { AMQPMessageSender, UUIDGenerator } from "./AMQPMessageSender";
import { MessagingSystem } from "../MessagingSystem";
import { Message } from "../Message";
import { Channel, Connection } from "amqplib";
import { MessageHandler } from "../MessageHandler";
import { Queue, QueueConsumer } from "@darkbyte/aqueue";
const amqp = require('amqplib');

const RETRY_TIMEOUT=5; // in seconds

interface MessageRegistration {
    messageNamePattern: string;
    handler: MessageHandler;
    registrationKey?: string;
}

interface OutgoingMessage {
    message: Message;
    registrationKey?: string;
}

export class AMQPMessagingSystem implements MessagingSystem {
    private connectionPromise: Promise<void>;
    private messageReceiver?: AMQPMessageReceiver;
    private messageSender?: AMQPMessageSender;
    private messageRegistrations: MessageRegistration[] = [];
    private outgoingMessages: Queue<OutgoingMessage> = new Queue();
    private messagesConsumer: QueueConsumer<OutgoingMessage> = new QueueConsumer(this.outgoingMessages);
    private connected = false;
    private canAcceptMessages = false;

    constructor(
        connectionOptions: any,
        private messageIdGenerator: UUIDGenerator,
        private outExchanges: string[],
        private inputExchange: string,
        private inputQueue = ''
    ) {
        this.connectionPromise = this.connect(connectionOptions);
        this.messagesConsumer.startConsuming((message: OutgoingMessage) => this.handleOutgoingMessage(message));
        this.messagesConsumer.pause();
    }

    private isConnected(): boolean {
        return this.connected;
    }
    
    private async connect(connectionOptions: any): Promise<void> {
        return amqp.connect(connectionOptions)
            .then((conn: Connection) => {
                console.debug('Connected to RabbitMQ!!!');

                conn.on('close', () => {
                    console.debug('Disconnected from RabbitMQ!!!');
                    this.connected = false;
                    this.connectionPromise = this.connect(connectionOptions);
                });

                return conn.createChannel();
            })
            .then((channel: Channel) => {
                return this.onChannel(channel);
            })
            .catch(() => {
                console.info(`Failed to connect to RabbitMQ, retrying in ${RETRY_TIMEOUT} seconds`);

                return new Promise<void>((resolve) => {
                    setTimeout(() => resolve(this.connect(connectionOptions)), RETRY_TIMEOUT*1000);
                });
            });
    }

    private async createInputQueue(channel: Channel): Promise<string> {
        if (this.inputQueue.length > 0) {
            return this.inputQueue;
        }
        
        return channel.assertQueue('', { durable: false, autoDelete: true })
            .then((response) => response.queue);
    }

    private handleRegistration(registration: MessageRegistration) {
        this.getMessageReceiver()
            .then((messageReceiver: AMQPMessageReceiver) => {
                messageReceiver.on(registration.messageNamePattern, registration.handler, registration.registrationKey);
            });
    }

    private async handleOutgoingMessage(message: OutgoingMessage): Promise<void> {
        return this.getMessageSender()
            .then((messageSender: AMQPMessageSender) => messageSender.send(message.message, message.registrationKey));
    }

    private async registerAllEvents(): Promise<void> {
        return Promise.all(
            this.messageRegistrations.map((reg) => this.handleRegistration(reg))
        ).then(() => undefined);
    }
    
    private createSenderAndReceiver(channel: Channel, inputQueue: string) {
        this.inputQueue = inputQueue;
        this.messageReceiver = new AMQPMessageReceiver(channel, this.inputExchange, inputQueue);
        this.messageSender = new AMQPMessageSender(channel, this.outExchanges, this.messageIdGenerator);
    }

    private acceptIncomingMessages() {
        if (!this.canAcceptMessages || !this.isConnected()) {
            return;
        }

        this.getMessageReceiver()
            .then((receiver) => receiver.startAcceptingMessages());
    }

    private sendOutgoingMessages() {
        this.messagesConsumer.resume();
    }

    private async onChannel(channel: Channel): Promise<void> {
        this.connected = true;

        return this.createInputQueue(channel)
            .then((queueName) => this.createSenderAndReceiver(channel, queueName))
            .then(() => this.registerAllEvents())
            .then(() => this.acceptIncomingMessages())
            .then(() => this.sendOutgoingMessages());
    }

    private getMessageReceiver(): Promise<AMQPMessageReceiver> {
        return this.connectionPromise.then(() => this.messageReceiver!);
    }

    private getMessageSender(): Promise<AMQPMessageSender> {
        return this.connectionPromise.then(() => this.messageSender!);
    }

    async send(message: Message, registrationKey?: string | undefined): Promise<void> {
        this.outgoingMessages.push({
            message,
            registrationKey
        });
    }

    public on(messageNamePattern: string, handler: MessageHandler, registrationKey?: string | undefined): void {
        this.messageRegistrations.push({
            messageNamePattern,
            handler,
            registrationKey
        });

        if (this.isConnected()) {
            this.handleRegistration({
                messageNamePattern,
                handler,
                registrationKey
            });
        }
    }

    public startAcceptingMessages(): void{
        this.canAcceptMessages = true;

        if (this.isConnected()) {
            this.acceptIncomingMessages();
        }
    }

}