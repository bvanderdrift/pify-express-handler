# Pify Express Handler

A tiny promisify package for easier testing of express handlers used in [Firebase Functions](https://firebase.google.com/docs/functions) & [Google Cloud Functions](https://cloud.google.com/functions).

🎉 **Bonus**: type definitions already provided!

⚠️ **Warning**: express middleware not supported.

## Usage:

```javascript
import { promisifyHandler } from "pify-express-handler"

const someHandler = async (req, res) => {
    await ...; // some call to a server
    res.status(201).send("It's been created!");
}

// Test
it("should create the resource if everything succeeds", async () => {
    const handler = promisifyHandler(someHandler);

    const {status, body} = await handler({/* empty request will suffice for this test*/});

    expect(status).to.equal(201);
    expect(body).to.equal("It's been created!");
})
```

## Why?

When you want to test your function you have a couple approaches.

- Installing the [Serverless Framework](https://www.serverless.com/) or [Postman](https://www.postman.com/use-cases/api-testing-automation/) - loads of overhead
- Stubbing your own `res` object for testing - loads of work.

Instead; you can use this package to make testing your function smooth as butter 🧈.

## Limitations

Currently, only functions that use nothing more than the following functions on the `res` object are supported:

- `.write()`
- `.status()`
- `.end()`
- `.send()`

If your function uses any other of the `res` object's functions this package will throw an error.

I'm happy to add more support later, if this package picks up. Please let me know through submitting an issue! 😀
