var PROTO_PATH = __dirname + '/../../protos/helloworld.proto';

process.env.GRPC_TRACE = 'list_tracers'
process.env.GRPC_VERBOSITY = 'DEBUG'

var parseArgs = require('minimist');
var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');

// grpc.setLogVerbosity(0)


grpc.setLogger({
    error(...args) {
        console.log('info1 ***', ...args);
    },
    log() {
        console.log('log ***', ...args);
    },
    info() {
        console.info('info ***', ...args);
    }
})

var packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {keepCase: true,
     longs: String,
     enums: String,
     defaults: true,
     oneofs: true
    });

var hello_proto = grpc.loadPackageDefinition(packageDefinition).helloworld;


const ECHO_PROTO_PATH = __dirname + '/../../protos/echo.proto';

const echoPackageDefinition = protoLoader.loadSync(
    ECHO_PROTO_PATH,
  {keepCase: true,
   longs: String,
   enums: String,
   defaults: true,
   oneofs: true
  });

const echoProto = grpc.loadPackageDefinition(echoPackageDefinition).grpc.examples.echo;




const Koa = require('koa')

const Router = require('koa-router');


const app = new Koa();

const router = new Router();

var argv = parseArgs(process.argv.slice(2), {
    string: 'target'
});
var target;
if (argv.target) {
    target = argv.target;
} else {
    target = 'localhost:50051';
}

let apm;

if(process.env.apmEnable) {
    apm = require('./apm');
    apm.start({
        active: true,
        // captureExceptions: false
        logLevel: 'off'
    })
}

process.on('exit', function () {
    console.log('exit *** 事件触发');
})


process.on('uncaughtException', function (err) {
    console.log('uncaughtException err', err);
})

const logInterceptor =  (options, nextCall) => { 
    return new grpc.InterceptingCall(nextCall(options), { 
      start(metadata, listener, next) {
        // 增删metadata
        let receivedMetaData;

        // 记录elasticoption
        let elasticoption;
        if (apm) {
            const result = apm.addTraceIdToMetadata(metadata, options.method_definition.path);
            elasticoption = result.elasticoption;
        }
        next(metadata, { 
            onReceiveMetadata(metadata, next) {
                receivedMetaData = metadata
                next(metadata)
            },
            onReceiveMessage(message, next) {
                next({
                    ...(message || {}),
                    metadata: receivedMetaData,
                    elasticoption
                })
            },
            onReceiveStatus(status, next) {
                // 如果grpc发生错误，则使用elasticoption获取传入的trace-id
                if (status.code) {
                    elasticoption?.traceId && status.metadata.add('trace-id', elasticoption?.traceId)
                }
                next(status)
            }
        });
      }
    }); 
};


const reloadError = [
    {
      reloadType: 1,
      reg: /failed.+connect/
    },
    {
      reloadType: 2,
      reg: /deadline.+exceeded/
    },
    {
      reloadType: 3,
      reg: /cannot.+read.+property/
    },
    {
      reloadType: 4,
      reg: /tcp.+read.+failed/
    },
    {
      reloadType: 5,
      reg: /internal.+http2.+error/
    },
    {
      reloadType: 6,
      reg: /stream.+removed/
    },
    {
      reloadType: 7,
      reg: /dns.+failed/
    },
    {
      reloadType: 8,
      reg: /channel.+destroyed/
    },
    {
      reloadType: 8,
      reg: /closed.+channel/
    }
  ]

function checkReloadError(message) {
    return reloadError.find(item => item.reg.test(message))
  }

let count = 0;


function getGrpcClient() {
      // { 'grpc.keepalive_timeout_ms': 10000, 'grpc.keepalive_time_ms': 30000 }
    const client = new hello_proto.Greeter(target, grpc.credentials.createInsecure(), {
        interceptors: [logInterceptor],
        'grpc.use_local_subchannel_pool': 1
    });
    client.id = (++count);
    return client;
}

function getEchoGrpcClient() {
      // { 'grpc.keepalive_timeout_ms': 10000, 'grpc.keepalive_time_ms': 30000 }
    const echoClient = new echoProto.Echo('localhost:50052', grpc.credentials.createInsecure(), {
        // 'grpc.use_local_subchannel_pool': 1
    });
    return echoClient;
}

var client = getGrpcClient();

console.log(grpc.connectivityState.READY, grpc.connectivityState.IDLE, grpc.connectivityState.CONNECTING, grpc.connectivityState.TRANSIENT_FAILURE, grpc.connectivityState.FATAL_FAILURE);

// setInterval(() => {
//     const state = client.getChannel().getConnectivityState(true);
//     console.log('state', state);
// }, 1000 * 20)

function grpcReady(traceId) {
    let timer;
    if (!client) {
        console.log('### 重新获取grpc client');
        // 连接失败之后，需要重新new clint进行rpc连接，才能够正常连接
        client = getGrpcClient();
    }
    return Promise.race([
        new Promise((resolve, reject) => {
            console.info('###: 初始化go-server-test的Greeter RPC服务...', traceId);
            try {
                client.waitForReady(Date.now() + 5000, (err) => {
                    clearTimeout(timer)
                    if (err) {
                        console.info('###: go-server-test的Greeter RPC服务初始化失败!', traceId, err);
                        return reject(err)
                    } else {
                        console.info('###: go-server-test的Greeter RPC服务初始化成功!', traceId);
                        resolve(true)
                    }
                })
            } catch (error) {
                console.log('****** error', traceId, error);
            }
        }),
        new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                console.info('###: go-server-test的Greeter RPC服务初始化失败!(timeout)', traceId);
                reject(new Error('waitForReady 未按时调用callback'))
            }, 5050)
        })
    ])
}

(async () => {
    await grpcReady()
})()

const methods = Object.keys(hello_proto.Greeter.prototype).filter((key) => typeof hello_proto.Greeter.prototype[key] === 'function')
console.log('methods', methods);
methods.forEach((key) => {
    let originCall = process.env.apmEnable ? require('./apm').addTraceIdToMetadataToSyncError(hello_proto.Greeter.prototype[key]) : hello_proto.Greeter.prototype[key];
    hello_proto.Greeter.prototype[key] = function (...args) {
        return new Promise((resolve, reject) => {
            try {
               originCall.apply(client, [...args, (err, result) => {
                    if (err) {
                        console.log('grpc error(async)', err.metadata.get('trace-id')[0], err.message); 
                        reject(err)
                    } else {
                        console.log('grpc end', result.metadata.get('trace-id')[0]); 
                        delete result.metadata;
                        delete result.elasticoption;
                        resolve(result)
                    }
               }]);
            } catch (error) {
                console.log('grpc error(sync)', error.traceId, error.message); 
                reject(error)
            }
        })
    }
})

methods.forEach((key) => {
    let originCall = hello_proto.Greeter.prototype[key];
    hello_proto.Greeter.prototype[key] = async function (...args) {
        try {
            const result = await Promise.race([
                originCall(...args).finally(() => {
                    clearTimeout(timer)
                }),
                new Promise((resolve) => {
                    let traceIdWrap = process.env.apmEnable ? require('./apm').traceIdWrap : () => (()=> {});
                    timer = setTimeout(traceIdWrap((traceId) => {
                        console.log('grpc error(race)', traceId, 'rpc调用触发超时错误'); 
                        resolve(new Error('rpc调用触发自定义超时错误'))
                    }), 5000)
                })
            ]);
            if (result instanceof Error) {
                throw result
            }
            return result
        } catch (error) {
            const message = (error.details || error.message || error.error || '').toLowerCase();
            if (checkReloadError(message)) {
                const traceId = error?.metadata?.get('trace-id')[0] || error.traceId;
                console.log('### 触发rpc重连', traceId);
                client.close();
                client = null;
                await grpcReady(traceId).catch((err) => {
                    console.log('grpcReady error', err);
                })
            }
            throw error
        }
    }
})



// 加入trace-id
// 加入日志打印
// grpc callback多传入一个参数
// 重启grpc

function getWorld() {
    
    var user;
    if (argv._.length > 0) {
        user = argv._[0]; 
    } else {
        user = 'world';
    }

    return new Promise((resolve, reject) => {
        
        client.sayHello({name: user}, function(err, response) {
            if (err) {
                reject(err)
            }
            console.log('Greeting:', response.message);
            return resolve(response)
        });
    })
}

function getWorldPromise() {
    
    var user;
    if (argv._.length > 0) {
        user = argv._[0]; 
    } else {
        user = 'world';
    }

    return client.sayHello({name: user}, { deadline: Date.now() + 10000 })
}

let echoClient = getEchoGrpcClient()
function getEchoPromise() {
    return new Promise((resolve, reject) => {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 1);
        if (!echoClient) {
            console.log('初始化新客户端');
            echoClient = getEchoGrpcClient() 
        }
        
        echoClient.unaryEcho({message: 'world'}, {deadline}, (error, value) => {
          if (error) {
            reject(error)
          }
          resolve(value);
          console.log('关闭客户端');
          echoClient.close()
          echoClient = null;
        });
      });
}

async function hellworld(ctx, next) {
    const result = await getWorld()
    ctx.status = 200
    ctx.type = 'json'
    ctx.body = result
}
async function helleGrpc(ctx, next) {
    try {
        const result = await getWorldPromise()
        ctx.body = result
    } catch (error) {
        ctx.body = error.message
    }
    ctx.status = 200
    ctx.type = 'json'
    
}

async function helleEcho(ctx, next) {
    try {
        const result = await getEchoPromise()
        ctx.body = result
    } catch (error) {
        ctx.body = error.message
    }
    ctx.status = 200
    ctx.type = 'json'
    
}


router.get('/hello/world', hellworld)
router.get('/hello/grpc', helleGrpc)
router.get('/hello/echo', helleEcho)

app.use(router.routes());

const port = process.env.PORT || 3001

app.listen({
  port,
  host: '0.0.0.0'
}, () => {
  console.log('afterStart 000', new Date(), `http://localhost:${port}`);

});


