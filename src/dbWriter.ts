import { SQSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const data = JSON.parse(record.body);

    await dynamo.put({
      TableName: process.env.DDB_TABLE!,
      Item: {
        id: `${Date.now()}-${Math.random()}`,
        name: data.name,
        age: Number(data.age),
        job: data.job
      }
    }).promise();
  }

  return { statusCode: 200 };
};
