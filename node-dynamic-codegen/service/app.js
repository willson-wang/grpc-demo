var PROTO_PATH = __dirname + '/../../protos/helloworld.proto';

var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
var packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {keepCase: true,
     longs: String,
     enums: String,
     defaults: true,
     oneofs: true
    });
var hello_proto = grpc.loadPackageDefinition(packageDefinition).helloworld;

/**
 * Implements the SayHello RPC method.
 */
function sayHello(call, callback) {
  console.log('metadata', call.metadata);
  const metadata = new grpc.Metadata();
  console.log(call.metadata.get('trace-id'))
  metadata.add('trace-id', call.metadata.get('trace-id'));
  metadata.add('elastic-apm-traceparent', call.metadata.get('elastic-apm-traceparent')[0]);
  metadata.add('random', `${Math.random()}`);
  call.sendMetadata(metadata)
  callback(null, {message: 'Hello1111 ' + call.request.name});
}

/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
function main() {
  var server = new grpc.Server();
  server.addService(hello_proto.Greeter.service, {sayHello: sayHello});
  server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    server.start();
  });
}

main();