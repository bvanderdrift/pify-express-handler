import { HttpFunction } from "@google-cloud/functions-framework/build/src/functions";
import { Request, Response } from "express";
import { Request as FirebaseRequest } from "firebase-functions/lib/providers/https";

const createNotSupportedError = (
  type: "function" | "property",
  itemName: string
) =>
  new Error(
    `This package currently does not support the '${itemName}' ${type} on the response object`
  );
const createFunctionNotSupportedError = (functionName: string) =>
  createNotSupportedError("function", functionName);
const createPropertyNotSupportedError = (propertyName: string) =>
  createNotSupportedError("property", propertyName);

type Body = string | Record<string, unknown>;

interface Headers {
  [key: string]: string;
}

type GoogleHandler = HttpFunction;
// Source from https://github.com/firebase/firebase-functions/blob/master/src/providers/https.ts#L44
// The package doesn't export the type
type FirebaseHandler = (
  req: FirebaseRequest,
  resp: Response
) => void | Promise<void>;

type ReturnValue = { status: number; body: Body; headers: Headers };

type PromisifyHandlerOverload = {
  (handler: GoogleHandler): (req: Request) => Promise<ReturnValue>;
  (handler: FirebaseHandler): (req: FirebaseRequest) => Promise<ReturnValue>;
};

export const promisifyHandler: PromisifyHandlerOverload = (
  handler: GoogleHandler | FirebaseHandler
) => async (req: Request | FirebaseRequest): Promise<ReturnValue> =>
  new Promise((resolve, reject) => {
    let status = 200;
    let body: Body = ``;
    let headers: Headers = {};

    // We're building this through mutations
    // So that we don't have to bind everything later
    const stubbedResponse: Response = {
      status: function (statusCode: number) {
        status = statusCode;
        return this;
      },
      write: function (bodyPartToAppend: string) {
        body += bodyPartToAppend;
        return true;
      },
      end: function () {
        resolve({
          status,
          body,
          headers,
        });
      },
      send: function (bodyPartToAppend: Body) {
        if (typeof bodyPartToAppend === "string") {
          this.write(bodyPartToAppend);
        } else if (typeof bodyPartToAppend === "object") {
          // Send accepts JSON. It will throw away whatever has been done in write.
          body = bodyPartToAppend;
        }

        this.end();
        return this;
      },

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      get app() {
        throw createPropertyNotSupportedError("app");
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      get headersSent() {
        throw createPropertyNotSupportedError("app");
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      get locals() {
        throw createPropertyNotSupportedError("app");
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      get rawBody() {
        throw createPropertyNotSupportedError("rawBody");
      },
      append: function () {
        throw createFunctionNotSupportedError("append");
      },
      attachment: function () {
        throw createFunctionNotSupportedError("attachment");
      },
      cookie: function () {
        throw createFunctionNotSupportedError("cookie");
      },
      clearCookie: function () {
        throw createFunctionNotSupportedError("clearCookie");
      },
      download: function () {
        throw createFunctionNotSupportedError("download");
      },
      format: function () {
        throw createFunctionNotSupportedError("format");
      },
      get: function () {
        throw createFunctionNotSupportedError("get");
      },
      json: function () {
        throw createFunctionNotSupportedError("json");
      },
      jsonp: function () {
        throw createFunctionNotSupportedError("jsonp");
      },
      links: function () {
        throw createFunctionNotSupportedError("links");
      },
      location: function () {
        throw createFunctionNotSupportedError("location");
      },
      redirect: function () {
        throw createFunctionNotSupportedError("redirect");
      },
      render: function () {
        throw createFunctionNotSupportedError("render");
      },
      sendFile: function () {
        throw createFunctionNotSupportedError("sendFile");
      },
      sendStatus: function () {
        throw createFunctionNotSupportedError("sendStatus");
      },
      set: function (arg1: string | Headers, arg2?: string) {
        if (typeof arg1 === "string" && typeof arg2 === "string") {
          headers[arg1] = arg2;
        } else if (typeof arg1 === "object" && arg2 === undefined) {
          headers = {
            ...headers,
            ...arg1,
          };
        } else {
          throw new Error(
            `Call signature arg1: '${typeof arg1}', arg2: '${typeof arg2}' not supported.`
          );
        }

        return this;
      },
      type: function () {
        throw createFunctionNotSupportedError("type");
      },
      vary: function () {
        throw createFunctionNotSupportedError("vary");
      },
    };

    try {
      // With the overload we have the guaranteed when handler is FirebaseHandler, the request will be FirebaseRequest
      // But, sadly tsc doesn't pick up on that and throws type error here. Therefore the cast.
      const result = handler(req as FirebaseRequest, stubbedResponse);

      // Check if the result is a promise, if so also set up
      // infrastructure to catch an error in the promise.
      if (result !== undefined && typeof result.catch === "function") {
        result.catch((e: unknown) => {
          reject(e);
        });
      }
    } catch (e) {
      reject(e);
    }
  });
