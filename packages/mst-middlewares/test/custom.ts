import { test } from "ava"
import atomic from "../src/atomic"
import { types, addMiddleware, getSnapshot } from "mobx-state-tree"

let error: any = null

function customMiddleware1(call, next) {
    // omit next() when there are more middlewares in the queue
    //return next(call)
}
function customMiddleware2(call, next) {
    return next(call)
}
function customMiddleware3(call, next, abort) {
    return abort("someValue")
}
function customMiddleware4(call, next, abort) {
    error = Error("customMiddleware called even though the queue was aborted")
    return next(call)
}

function noHooksMiddleware(call, next) {
    // thowing errors will lead to the aborting of further middlewares
    // => don't throw here but set a global var instead
    if (call.name === "postProcessSnapshot") error = Error("hook in middleware")
    return next(call)
}

const TestModel = types
    .model("Test1", {
        z: 1
    })
    .actions(self => {
        return {
            inc(x) {
                self.z += x
                return self.z
            },
            postProcessSnapshot(snapshot) {
                return snapshot
            }
        }
    })

test("next()/ abort() omitted within middleware", t => {
    const m = TestModel.create()
    addMiddleware(m, customMiddleware1)
    let thrownError: any = null
    try {
        m.inc(1)
    } catch (e) {
        thrownError = e
    }
    t.is(!!thrownError, true)
})

test("abort() middleware queue", t => {
    error = null
    const m = TestModel.create()
    addMiddleware(m, customMiddleware3) // contains abort()
    addMiddleware(m, customMiddleware4) // would contain next() - should never be invoked

    // the return value should be the one from the middleware 3
    const valueFromMiddleware: any = m.inc(1)
    t.is(valueFromMiddleware, "someValue")
    t.is(!!error, false) // make sure the cutomMiddleware4 was never invoked
})

test("middleware should be invoked on hooks", t => {
    const m = TestModel.create()
    error = null
    addMiddleware(m, noHooksMiddleware)
    m.inc(1)
    t.is(!!error, true)
})

test("middleware should not be invoked on hooks", t => {
    const m = TestModel.create()
    error = null
    addMiddleware(m, noHooksMiddleware, false)
    m.inc(1)
    t.is(!error, true)
})
