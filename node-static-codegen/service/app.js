var messages = require('./helloworld_pb');
var services = require('./helloworld_grpc_pb');

var grpc = require('grpc');

function getMillseconds(time) {
  return Number(time)/1000000
}

/**
 * Implements the SayHello RPC method.
 */
const timeMap = {}
var timer = null
function sayHello(call, callback) {
  var reply = new messages.HelloReply();
  // console.log('metadata', );
  // const startTime = call.metadata.get('mock-mode')
  // const serverTime = process.hrtime.bigint()
 
  // console.log('serverTime', serverTime);
  // if (timer) {
  //   clearTimeout(timer)
  // }
  // timer = setTimeout(() => {
  //   console.log('timeMap', timeMap);
  // }, 1000)
  reply.setMessage('Hello2 ' + call.request.getName());
  // timeMap[serverTime] = {
  //   startTime,
  //   span: getMillseconds(Number(serverTime) - startTime)
  // }
  // throw new Error('主动抛错')
  // call.sendMetadata(metadata)
  console.log('call', call.getPeer());
  callback(null, reply);
  // setTimeout(() => {
  // }, 4000)
}


function sayHelloStreamRequest(call, callback) {
  var reply = new messages.HelloReply();
  var info = ''
  call.on('data', function (buff) {
    info += buff
  })
  call.on('end', function () {
    reply.setMessage('Hello ' + info);
    callback(null, reply);
  })
  call.on('error', function () {
    console.log('error', error);
  })
}

/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
function main() {
  var server = new grpc.Server();
  server.addService(services.GreeterService, {sayHello: sayHello, sayHelloStreamRequest});
  server.bindAsync('0.0.0.0:50052', grpc.ServerCredentials.createInsecure(), () => {
    server.start();
  });
}

main();