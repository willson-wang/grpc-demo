var PROTO_PATH = __dirname + '/../../protos/helloworld.proto';

var parseArgs = require('minimist');
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

function getWorld() {
    var client = new hello_proto.Greeter(target, grpc.credentials.createInsecure());
    var user;
    if (argv._.length > 0) {
        user = argv._[0]; 
    } else {
        user = 'world';
    }

    console.log('client', client.prototype);
    
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

async function hellworld(ctx, next) {
    const result = await getWorld()
    ctx.status = 200
    ctx.type = 'json'
    ctx.body = result
}

router.get('/hello/world', hellworld)

app.use(router.routes());

const port = process.env.PORT || 3001

app.listen({
  port,
  host: '0.0.0.0'
}, () => {
  console.log('afterStart 000', new Date(), `http://localhost:${port}`);
});


