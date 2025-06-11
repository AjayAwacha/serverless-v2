import { S3Event, Context } from "aws-lambda";
import * as AWS from "aws-sdk";
import csv from 'csv-parser';

const s3 = new AWS.S3();
const sns = new AWS.SNS();

export const handler = async (event: S3Event, context: Context) => {
  try {
    // Validate event structure
    const record = event.Records?.[0];
    if (!record) {
      throw new Error("No records found in the S3 event.");
    }

    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const snsTopicArn = process.env.SNS_TOPIC_ARN;

    if (!snsTopicArn) {
      throw new Error("SNS_TOPIC_ARN environment variable is not set.");
    }

    const params = { Bucket: bucket, Key: key };

    console.log(`Fetching object from S3 - Bucket: ${bucket}, Key: ${key}`);

    const stream = s3.getObject(params).createReadStream();

    const results: any[] = await parseCSV(stream);

    for (const item of results) {
      console.log("Publishing message to SNS:", item);

      await sns.publish({
        TopicArn: snsTopicArn,
        Message: JSON.stringify(item),
      }).promise();
    }

    console.log("All messages successfully published to SNS.");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "CSV processed and messages published." }),
    };

  } catch (error: any) {
    console.error("Error processing S3 event:", {
      errorMessage: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process CSV and publish messages." }),
    };
  }
};

// Utility function to parse CSV from stream
function parseCSV(stream: NodeJS.ReadableStream): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];

    stream
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (err) => reject(new Error(`CSV parsing failed: ${err.message}`)));
  });
}
