const apm = require('elastic-apm-node')
const cookie = require('cookie');
const grpc = require('grpc')

function addTraceIdToMetadata(metadata, path) {
    if (!(metadata instanceof grpc.Metadata)) {
        throw new Error('传入的metadata不是grpc.Metadata实例');
    }
    let elasticoption = {};
    const currentTransaction = apm.currentTransaction;
    if (!metadata) {
        metadata = new grpc.Metadata();
    }
    try {
        const req = currentTransaction.req;
        const headers = req.headers;
        const cookies = headers.cookie ? cookie.parse(headers.cookie) : {};
        const all = Object.assign(Object.assign({}, headers), cookies);
        const clientRequestId = all['request-id'] || all['trace-id'] || '';
        const traceId = currentTransaction.traceId;
        delete all['trace-id'];
        if (clientRequestId) {
            metadata.add('request-id', clientRequestId);
        }
        metadata.add('trace-id', traceId);
        metadata.add('elastic-apm-traceparent', currentTransaction.traceparent);
        if (process.env.NODE_ENV !== 'production') {
            metadata.add('mock-mode', 'dev');
        }
        Object.keys(all).forEach((key) => {
            if (/^trace-.+/.test(key)) {
                metadata.add(key, all[key]);
            }
        });
        elasticoption = {
            url: req.url,
            method: req.method,
            headers: req.headers,
            metadata, traceId, path
        };

        return {
            elasticoption,
            metadata
        }
    }
    catch (err) {
        console.error('have some error:', err);
    }
}

function addTraceIdToMetadataToSyncError(fn) {
    return function (...args) {
        const currentTransaction = apm.currentTransaction;
        try {
            console.log('grpc begin', currentTransaction.traceId); 
            fn.apply(this, args)
        } catch (error) {
            error.traceId = currentTransaction.traceId
            throw error
        }
    }
}

function traceIdWrap(fn) {
    return function () {
        const currentTransaction = apm.currentTransaction;
        fn(currentTransaction.traceId)
    }
}

module.exports = apm
module.exports.addTraceIdToMetadata = addTraceIdToMetadata;
module.exports.addTraceIdToMetadataToSyncError = addTraceIdToMetadataToSyncError;
module.exports.traceIdWrap = traceIdWrap;