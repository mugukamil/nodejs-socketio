const express = require('express')
const redis = require('redis')
const redisClient = redis.createClient()
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)

let storeMessages = (name, data) => {
    let message = JSON.stringify({name, data})

    redisClient.lpush('messages', message, (err, res) => {
        redisClient.ltrim('messages', 0, 9)
    })
}

io.on('connection', (client) => {
    client.on('join', (name) => {
        client.nickname = name
        console.log('joined', client.nickname);
        client.broadcast.emit('chat', `${name} joined the chat`)
        client.broadcast.emit('add chatter', { name: client.nickname })

        redisClient.smembers('names', (err, names) => {
            names.forEach(name => {
                console.log('foreach', name);
                client.emit('add chatter', name)
            })
        })

        redisClient.lrange('messages', 0, -1, (err, messages) => {
            messages.reverse()

            messages.forEach(message => {
                message = JSON.parse(message)
                client.emit('messages', `${message.name}: ${message.data}`)
            })
        })

        redisClient.sadd('chatters', name)
    })

    client.on('messages', (message) => {
        client.broadcast.emit('messages', `${client.nickname}: ${message}`)
        client.emit('messages', `${client.nickname}: ${message}`)
        storeMessages(client.nickname, message)
    })

    client.on('disconnect', () => {
        if (client && client.nickname) {
            client.broadcast.emit('remove chatter', { name: client.nickname})

            redisClient.srem('chatters', client.nickname)
        }
    })
})

app.get('/', (req, res) => {
    res.sendFile(`${__dirname}/index.html`)
})

server.listen(3002, () => console.log('listening on 30002'))
