import { handler } from "../src/csvProcessor";
import { S3Event } from 'aws-lambda';
import { Readable, Transform } from 'stream';

// Manual mocking AWS SDK
jest.mock('aws-sdk', () => {
  const mS3 = {
    getObject: jest.fn(),
  }
  const mSNS = {
    publish: jest.fn().mockReturnThis(),
    promise: jest.fn(),
  };
  return {
    S3: jest.fn(() => mS3),
    SNS: jest.fn(() => mSNS),
  };
});

jest.mock('csv-parser', () => jest.fn());

import AWS from 'aws-sdk';
import csv from 'csv-parser';

const mockS3 = new AWS.S3() as jest.Mocked<any>;
const mockSNS = new AWS.SNS() as jest.Mocked<any>;

describe('Lambda handler', () => {
  const mockEvent: S3Event = {
    Records: [{
      eventVersion: '2.1',
      eventSource: 'aws:s3',
      awsRegion: 'us-east-1',
      eventTime: new Date().toISOString(),
      eventName: 'ObjectCreated:Put',
      userIdentity: { principalId: 'EXAMPLE' },
      requestParameters: { sourceIPAddress: '127.0.0.1' },
      responseElements: {
        'x-amz-request-id': 'EXAMPLE123456789',
        'x-amz-id-2': 'EXAMPLE5678/example=',
      },
      s3: {
        s3SchemaVersion: '1.0',
        configurationId: 'testConfigRule',
        bucket: {
          name: 'my-bucket',
          ownerIdentity: { principalId: 'EXAMPLE' },
          arn: 'arn:aws:s3:::my-bucket',
        },
        object: {
          key: encodeURIComponent('test.csv'),
          size: 123,
          eTag: 'etag123',
          sequencer: '1234567890',
        },
      },
    }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SNS_TOPIC_ARN = 'arn:aws:sns:region:account-id:topic';
  });

  it('should process CSV and publish SNS messages', async () => {
    const csvData = [
      { name: 'John', age: '30' },
      { name: 'Jane', age: '25' }
    ];

    const stream = new Readable({ objectMode: true });
    stream._read = () => {
      csvData.forEach(row => stream.push(row));
      stream.push(null);
    };

    mockS3.getObject.mockReturnValue({
      createReadStream: () => stream,
    });

    (csv as jest.Mock).mockImplementation(() => new Transform({
      objectMode: true,
      transform(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null, data?: any) => void) {
        callback(null, chunk); // passthrough
      },
    }));

    mockSNS.promise.mockResolvedValue({});

    const result = await handler(mockEvent);

    expect(result).toEqual({
      statusCode: 200,
      body: 'CSV processed and messages published.',
    });

    expect(mockSNS.publish).toHaveBeenCalledTimes(2);
  });

  it('should handle SNS publish error', async () => {
    const csvData = [{ name: 'John', age: '30' }];

    const stream = new Readable({ objectMode: true });
    stream._read = () => {
      csvData.forEach(row => stream.push(row));
      stream.push(null);
    };

    mockS3.getObject.mockReturnValue({
      createReadStream: () => stream,
    });

    (csv as jest.Mock).mockImplementation(() => new Transform({
      objectMode: true,
      transform(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null, data?: any) => void) {
        callback(null, chunk);
      },
    }));

    mockSNS.promise.mockRejectedValue(new Error('SNS error'));

    await expect(handler(mockEvent)).rejects.toThrow('SNS error');
  });
});
