import { Service } from 'services/core/service';
import {
  E_JSON_RPC_ERROR,
  IJsonRpcResponse,
  IJsonRpcRequest,
  IJsonRpcEvent,
  IJsonrpcServiceApi,
} from './jsonrpc-api';
import uuid from 'uuid/v4';

export class JsonrpcService extends Service implements IJsonrpcServiceApi {
  static createError(
    requestOrRequestId: string | IJsonRpcRequest,
    options: { code: E_JSON_RPC_ERROR; message?: string },
  ): IJsonRpcResponse<any> {
    const id =
      arguments[0] && typeof arguments[0] === 'object'
        ? (arguments[0] as IJsonRpcRequest).id
        : arguments[0];
    return {
      id,
      jsonrpc: '2.0',
      error: {
        code: options.code,
        // tslint:disable-next-line:prefer-template
        message: E_JSON_RPC_ERROR[options.code] + (options.message ? ' ' + options.message : ''),
      },
    };
  }

  static createRequest(resourceId: string, method: string, ...args: any[]): IJsonRpcRequest {
    return {
      method,
      jsonrpc: '2.0',
      id: uuid(),
      params: {
        args,
        resource: resourceId,
      },
    };
  }

  static createRequestWithOptions(
    resourceId: string,
    method: string,
    options: { compactMode: boolean; fetchMutations: boolean },
    ...args: any[]
  ): IJsonRpcRequest {
    const request = this.createRequest(resourceId, method, ...args);
    request.params = { ...request.params, ...options };
    return request;
  }

  static createResponse<TResult>(
    requestOrRequestId: string | IJsonRpcRequest,
    result: TResult = null,
  ): IJsonRpcResponse<TResult> {
    const id =
      arguments[0] && typeof arguments[0] === 'object'
        ? (arguments[0] as IJsonRpcRequest).id
        : arguments[0];
    return { id, result, jsonrpc: '2.0' } as IJsonRpcResponse<TResult>;
  }

  static createEvent(options: {
    emitter: 'PROMISE' | 'STREAM';
    resourceId: string;
    data: any;
    isRejected?: boolean;
  }): IJsonRpcResponse<IJsonRpcEvent> {
    return this.createResponse<IJsonRpcEvent>(null, {
      _type: 'EVENT',
      ...options,
    });
  }

  createError(
    requestOrRequestId: string | IJsonRpcRequest,
    options: { code: E_JSON_RPC_ERROR; message?: string },
  ): IJsonRpcResponse<any> {
    return JsonrpcService.createError.apply(this, arguments);
  }

  createRequest(resourceId: string, method: string, ...args: any[]): IJsonRpcRequest {
    return JsonrpcService.createRequest.apply(this, arguments);
  }

  createRequestWithOptions(
    resourceId: string,
    method: string,
    options: { compactMode: boolean; fetchMutations: boolean },
    ...args: any[]
  ): IJsonRpcRequest {
    return JsonrpcService.createRequestWithOptions.apply(this, arguments);
  }

  createResponse<TResult>(
    requestOrRequestId: string | IJsonRpcRequest,
    result: TResult,
  ): IJsonRpcResponse<TResult> {
    return JsonrpcService.createResponse.apply(this, arguments);
  }

  createEvent(options: {
    emitter: 'PROMISE' | 'STREAM';
    resourceId: string;
    data: any;
    isRejected?: boolean;
  }): IJsonRpcResponse<IJsonRpcEvent> {
    return JsonrpcService.createResponse.apply(this, arguments);
  }
}
