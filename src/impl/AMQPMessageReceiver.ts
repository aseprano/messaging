import { MessageReceiver } from "../MessageReceiver";
import { MessageHandler } from "..//MessageHandler";
import { MessageSubscription } from "./MessageSubscription";
import { IncomingMessage } from "../IncomingMessage";
import { Channel, ConsumeMessage } from "amqplib";

export class AMQPMessageReceiver implements MessageReceiver {
    private subscriptions: MessageSubscription[] = [];

    constructor(
        private channel: Channel,
        private exchangeName: string,
        private queueName: string
    ) {}

    private isValidPattern(pattern: string): boolean {
        return pattern.match(/^([a-z0-9\-_]+|[*]|[?])(\.([a-z0-9\-_]+|[*]|[?]))*$/i) !== null;
    }

    private namePatternToRoutingKey(pattern: string, registrationKey?: string): string {
        return (typeof registrationKey !== "undefined" ? registrationKey : '#') + '.' + pattern.replace(/\*/g, '#').replace(/\?/g, '*');
    }
    
    on(messageNamePattern: string, handler: MessageHandler, registrationKey?: string): void {
        if (!this.isValidPattern(messageNamePattern)) {
            throw new Error(`Invalid message name pattern: ${messageNamePattern}`);
        }

        this.subscriptions.push(new MessageSubscription(messageNamePattern, handler, registrationKey));
        
        console.debug(`Registering for event with name ${messageNamePattern} (registrationKey: ${registrationKey})`);
        
        this.channel.bindQueue(
            this.queueName,
            this.exchangeName,
            this.namePatternToRoutingKey(messageNamePattern, registrationKey)
        );
    }

    parseMessageFromData(data: ConsumeMessage|null): IncomingMessage {
        if (!data) {
            throw new Error('Got no data');
        }

        const stringContent = data!.content.toString();
        const message = JSON.parse(stringContent) as IncomingMessage;

        if (!message.name || !message.data || !message.id) {
            throw new Error('Reveived malformed IncomingMessage');
        }

        message.registrationKey = message.registrationKey || '';

        return message;
    }

    route(message: IncomingMessage) {
        this.subscriptions
            .forEach((subscription) => subscription.handle(message));
    }

    async startAcceptingMessages(): Promise<void> {
        return this.channel.consume(
            this.queueName,
            (receivedData: ConsumeMessage|null) => {
                if (!receivedData) {
                    return;
                }

                try {
                    this.route(this.parseMessageFromData(receivedData));
                } catch (error) {
                    console.error(`Error parsing message: ${error.message}`);
                }

                this.channel.ack(receivedData);
            }
        ).then(() => undefined);
    }
    
}