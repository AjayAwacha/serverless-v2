import { S3Event } from "aws-lambda";
import * as AWS from "aws-sdk";
import csv from 'csv-parser';

const s3 = new AWS.S3();
const sns = new AWS.SNS();

export const handler = async (event: S3Event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

  const params = { Bucket: bucket, Key: key };
  const stream = s3.getObject(params).createReadStream();

  const results: any[] = [];

  await new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on("data", (data: any) => results.push(data))
      .on("end", resolve)
      .on("error", reject);
  });

  for (const record of results) {
    await sns.publish({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify(record),
    }).promise();
  }

  return { statusCode: 200, body: "CSV processed and messages published." };
};
