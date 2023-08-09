var parseArgs = require('minimist');
var { Metadata } =  require('grpc');
const {
    performance,
  } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
var messages = require('./helloworld_pb');
var services = require('./helloworld_grpc_pb');

var grpc = require('grpc');

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
    // target = 'go-server-test:9000';
    target = 'localhost:50051';
}

var client = new services.GreeterClient(target,
    grpc.credentials.createInsecure(), {
        "grpc.max_send_message_length": 20
    });

let timeMap = {}

// const clientMap = {}
// const len = 2

// for (let i = 0; i < len; i++) {
//     clientMap[i] = new services.GreeterClient(target,
//         grpc.credentials.createInsecure(), {
//             "grpc.use_local_subchannel_pool": 1,
//             "grpc.http2.write_buffer_size": 1269760
//             // "grpc.max_concurrent_streams": 50000000,
//         });
// }

// console.log('xxx GRPC_VERBOSITY', process.env.GRPC_VERBOSITY, process.env);

function getMillseconds(time) {
    return Number(time)/1000000
}
let queue = null

import('p-queue').then((pkg) => {
    // PQueue
    queue = new pkg.default({concurrency: 10});
});


function getWorld() {
   
    var request = new messages.HelloRequest();
    var user;
    if (argv._.length > 0) {
        user = argv._[0]; 
    } else {
        user = 'world';
    }
    request.setName(user);

    return queue.add(() => {
        return new Promise((resolve, reject) => {
            // console.log('xxxx', queue.size);
            const startTime = process.hrtime.bigint()
            
            const call = client.sayHello(request, function(err, response) {
                const lastTime = process.hrtime.bigint()
                timeMap[`key_${lastTime}`] = getMillseconds(lastTime - startTime)
                if (err) {
                    if (err.details.includes('TCP Read failed')) {
                        console.log('err.details', err.details);
                    }
                    reject(err)
                }
                // console.log('Greeting:', response);
                resolve((response && response.getMessage()) || '未正确返回消息')
            });
    
            console.log('call', call.getPeer());
        })
    })

    
}

function hellegrpcstream() {
   
    var request = new messages.HelloRequest();
    var user;
    if (argv._.length > 0) {
        user = argv._[0]; 
    } else {
        user = 'world2';
    }
    request.setName(user);

    return new Promise((resolve, reject) => {
        const startTime = process.hrtime.bigint()
        const call = client.sayHelloStreamRequest(function(err, response) {
            const lastTime = process.hrtime.bigint()
            timeMap[`key_${lastTime}`] = getMillseconds(lastTime - startTime)
            if (err) {
                reject(err)
            }
            resolve((response && response.getMessage()) || '未正确返回消息')
        });
        
        call.write(request)
        call.end();
    })
}

async function hellegrpc(ctx, next) {
    let result = 'default value'
    try {
        result = await getWorld()
    } catch (error) {
        console.log('rpc请求错误', error);
    }
    ctx.status = 200
    // ctx.type = 'json'
    ctx.body = result
}

async function hellegrpc2(ctx, next) {
    const result = await hellegrpcstream()
    ctx.status = 200
    // ctx.type = 'json'
    ctx.body = result
}

async function helleworld(ctx, next) {
    ctx.status = 200
    // ctx.type = 'json'
    ctx.body = 'hello world'
}

async function debug(ctx, next) {
    ctx.status = 200
    // ctx.type = 'json'
    ctx.body = 'ok'
}

async function getTime(ctx, next) {
    ctx.status = 200
    ctx.type = 'json'
    ctx.body = timeMap
}

async function clearTime(ctx, next) {
    timeMap = {}
    ctx.status = 200
    ctx.type = 'json'
    ctx.body = timeMap
}

router.get('/hello/world', helleworld)
router.get('/hello/grpc', hellegrpc)
router.get('/hello/grpc2', hellegrpc2)
router.get('/debug/vars', debug)
router.get('/gettime', getTime)
router.get('/cleartime', clearTime)

app.use(router.routes());

const port = process.env.PORT || 9000

// const filePath = path.join(__dirname, 'log.txt')
// console.log('filePath', filePath);
// const file = fs.createWriteStream(filePath)

// process.stdout.on("data", data => {
//     // data = data.toString().toUpperCase()
//     // process.stdout.write(data + "\n")
//     file.write(data)
// })

// process.stdout.pipe(file)

app.listen({
  port,
  host: '0.0.0.0'
}, () => {
  console.log('afterStart 000', new Date(), `http://localhost:${port}`);
});
