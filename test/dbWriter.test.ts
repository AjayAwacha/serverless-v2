// test/sqsHandler.test.ts
import { handler } from '../src/dbWriter';
import { SQSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

jest.mock('aws-sdk', () => {
  const putMock = jest.fn().mockReturnThis();
  const promiseMock = jest.fn().mockResolvedValue({});
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        put: putMock,
        promise: promiseMock
      }))
    }
  };
});

const mockSQSEvent: SQSEvent = {
    Records: [
      {
        body: JSON.stringify({ name: 'Ajay', age: '30', job: 'Engineer' })
      },
      {
        body: JSON.stringify({ name: 'Nina', age: '25', job: 'Designer' })
      }
    ] as any
  };

  describe('SQS handler test suite', () => {
    it('should write all SQS records to DynamoDB', async () => {
      // Mock environment variable
      process.env.DDB_TABLE = 'mock-table';
  
      const response = await handler(mockSQSEvent);
  
      expect(response).toEqual({ statusCode: 200 });
  
      const dynamoInstance = new (AWS.DynamoDB.DocumentClient as any)();
  
      expect(dynamoInstance.put).toHaveBeenCalledTimes(2);
  
      expect(dynamoInstance.put).toHaveBeenCalledWith(expect.objectContaining({
        TableName: 'mock-table',
        Item: expect.objectContaining({
          name: 'Ajay',
          age: 30,
          job: 'Engineer'
        })
      }));
  
      expect(dynamoInstance.put).toHaveBeenCalledWith(expect.objectContaining({
        TableName: 'mock-table',
        Item: expect.objectContaining({
          name: 'Nina',
          age: 25,
          job: 'Designer'
        })
      }));
    });
  });
  