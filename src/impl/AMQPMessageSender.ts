import { Channel } from "amqplib";
import { MessageSender } from "../MessageSender";
import { Message } from "../Message";

export type UUIDGenerator = () => string;

export class AMQPMessageSender implements MessageSender {

    constructor(
        private channel: Channel,
        private outExchanges: string[],
        private uuidGenerator: UUIDGenerator
    ) {}

    private generateNewId(): string {
        return this.uuidGenerator();
    }

    async send(message: Message, registrationKey?: string | undefined): Promise<void> {
        const routingKey = (registrationKey || '') + '.' + message.name;

        const data = {
            ...message,
            id: this.generateNewId(),
            registrationKey: registrationKey || '',
        };

        const stringifiedData = JSON.stringify(data);
        
        this.outExchanges.forEach((exchangeName) => {
            console.debug(`Sending message to exchange ${exchangeName}`);
            
            if (!this.channel.publish(
                exchangeName,
                routingKey,
                Buffer.from(stringifiedData)
            )) {
                return Promise.reject(new Error(`Error publishing on exchange ${exchangeName} using routingKey ${routingKey}`));
            }
        })
    }

}
