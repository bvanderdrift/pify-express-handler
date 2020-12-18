import { expect } from "chai";
import { install, InstalledClock } from "@sinonjs/fake-timers";
import { promisifyHandler } from ".";
import { HttpFunction } from "@google-cloud/functions-framework/build/src/functions";
import { Request as FirebaseRequest } from "firebase-functions/lib/providers/https";
import { Request, Response } from "express";

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

type ExpressHandler = (req: Request, resp: Response) => void | Promise<void>;
type GoogleHandler = HttpFunction;
// Source from https://github.com/firebase/firebase-functions/blob/master/src/providers/https.ts#L44
// The package doesn't export the type
type FirebaseHandler = (
  req: FirebaseRequest,
  resp: Response
) => void | Promise<void>;

describe("promisifyHandler", () => {
  const minuteInMs = 60000;
  let clock: InstalledClock;

  before(() => {
    clock = install();
  });

  after(() => {
    clock.uninstall();
  });

  it("should default to status code 200", async () => {
    const handler: ExpressHandler = (req, res) => {
      res.send("All ok");
    };
    const request = {} as Request;

    const { status } = await promisifyHandler(handler)(request);
    expect(status).to.equal(200);
  });

  it("should accept Google Cloud functions", async () => {
    // This test would fail at build time by triggering a typescript error
    const handler: GoogleHandler = (req, res) => {
      res.send("All ok");
    };
    const request = {} as Request;

    const { status } = await promisifyHandler(handler)(request);
    expect(status).to.equal(200);
  });

  it("should accept Firebase functions", async () => {
    // This test would fail at build time by triggering a typescript error
    const handler: FirebaseHandler = (req, res) => {
      res.send("All ok");
    };
    const request = {} as FirebaseRequest;

    const { status } = await promisifyHandler(handler)(request);
    expect(status).to.equal(200);
  });

  it("should be able to have other codes set", async () => {
    const handler: ExpressHandler = (req, res) => {
      res.status(404).send("Oh no!");
    };
    const request = {} as Request;

    const { status } = await promisifyHandler(handler)(request);
    expect(status).to.equal(404);
  });

  it("should not resolve if .end isn't called", async () => {
    const handler: ExpressHandler = (req, res) => {
      res.write("Something");
      res.status(403);
    };
    const request = {} as Request;

    // Inspired by https://stackoverflow.com/questions/52283243/mocha-how-to-test-for-unsettled-promise
    const resolvedIndicator = "resolvedIndicator";

    const promise = Promise.race([
      promisifyHandler(handler)(request), // Hanging promise
      new Promise((resolve) =>
        setTimeout(resolve, minuteInMs, resolvedIndicator)
      ),
    ]);
    promise.then((val: unknown) => {
      expect(val).to.equal(resolvedIndicator);
    });
    clock.tick(minuteInMs); // Forwarding time a minute
  });

  it("should allow for multiple writes", async () => {
    const handler: ExpressHandler = (req, res) => {
      res.write("1");
      res.write("2");
      res.send("3");
    };
    const request = {} as Request;

    const { body } = await promisifyHandler(handler)(request);
    expect(body).to.equal("123");
  });

  it("should allow for a single .write + .end using .send", async () => {
    const expectedBody = "Hello World";
    const handler: ExpressHandler = (req, res) => {
      res.send(expectedBody);
    };
    const request = {} as Request;

    const { body } = await promisifyHandler(handler)(request);
    expect(body).to.equal(expectedBody);
  });

  it("should allow for async functions", async () => {
    const expectedBody = "Not Allowed";
    const expectedCode = 403;
    const handler: ExpressHandler = async (req, res) => {
      await sleep(minuteInMs);
      res.status(expectedCode).send(expectedBody);
    };
    const request = {} as Request;

    promisifyHandler(handler)(request).then((val) => {
      expect(val).to.exist;

      expect(val.body).to.equal(expectedBody);
      expect(val.status).to.equal(expectedCode);
    });
    clock.tick(minuteInMs);
  });

  it("should allow for catching errors in promises", async () => {
    const expectedErrorMessage = "foo";
    const handler = async () => {
      await sleep(minuteInMs);
      throw new Error(expectedErrorMessage);
    };
    const request = {} as Request;

    promisifyHandler(handler)(request)
      .then(() => {
        expect(true).to.equal(false, "This situation shouldn't occur!");
      })
      .catch((e) => {
        expect(e).to.exist;
        expect(e.message).to.equal(expectedErrorMessage);
      });

    clock.tick(minuteInMs);
  });

  it("should allow for catching errors synchronous calls", async () => {
    const expectedErrorMessage = "foo";
    const handler = () => {
      throw new Error(expectedErrorMessage);
    };
    const request = {} as Request;

    promisifyHandler(handler)(request)
      .then(() => {
        expect(true).to.equal(false, "This situation shouldn't occur!");
      })
      .catch((e) => {
        expect(e).to.exist;
        expect(e.message).to.equal(expectedErrorMessage);
      });
  });

  it("should allow for stacking status and send", async () => {
    const expectedBody = "I'm a teapot!";
    const expectedCode = 418;
    const handler: ExpressHandler = (req, res) => {
      res.status(expectedCode).send(expectedBody);
    };
    const request = {} as Request;

    const { status, body } = await promisifyHandler(handler)(request);
    expect(status).to.equal(expectedCode);
    expect(body).to.equal(expectedBody);
  });

  it("should allow for accepting JSON through .send", async () => {
    const responseObject = {
      foo: "bar",
      bar: "foo",
    };
    const handler: ExpressHandler = (req, res) => {
      res.send(responseObject);
    };
    const request = {} as Request;

    const { body } = await promisifyHandler(handler)(request);
    expect(body).to.equal(JSON.stringify(responseObject));
  });

  it("should allow for accepting JSON through .json", async () => {
    const responseObject = {
      foo: "bar",
      bar: "foo",
    };
    const handler: ExpressHandler = (req, res) => {
      res.json(responseObject);
    };
    const request = {} as Request;

    const { body } = await promisifyHandler(handler)(request);
    expect(body).to.equal(JSON.stringify(responseObject));
  });
});
