const easyNetconf = require('./easynetconf-cjs');

const express = require('express')
const dotenv = require('dotenv');
dotenv.config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const path = require('path');
const fs = require('fs');

const { XMLParser } = require("fast-xml-parser");
const parser = new XMLParser();

const filePath = process.argv[2] || path.join(__dirname, 'networks.xml');
const postgresUrl = process.argv[3] || process.env.DATABASE_URL;
const pollingInterval = process.argv[4] || 10000; // Default to 1 second for testing

if (!postgresUrl) {
    console.error('Postgres URL not provided. Please set the DATABASE_URL environment variable or pass it as a command line argument.');
    process.exit(1);
}

prisma.$connect()
    .then(() => {
        console.log('Connected to the database');
    })
    .catch((error) => {
        console.error('Error connecting to the database:', error);
        process.exit(1);
    });

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

// Read the XML file
let content = fs.readFileSync(filePath, 'utf8');
content = parser.parse(content);

function processNetworks(data) {
    let networks = data.config.networks.network;

    if (!Array.isArray(networks)) {
        networks = [networks];
    }

    let devices = [];

    networks.forEach((network) => {

        if (!Array.isArray(network.node)) {
            network.node = [network.node];
        }

        network.node.forEach((node) => {
            devices.push({ 'id': node['node-id'], 
                'user': node['netconf-connect-params']['user'], 
                'server': node['netconf-connect-params']['server'], 
                'password': node['netconf-connect-params']['password'], 
                'port': node['netconf-connect-params']['ncport'] 
            });
        });
    });

    return devices;
}

function createSessions(devices) {
    devices.forEach(device => {
        session = new easyNetconf()
        device.session = session

        session.async_connect(device.server, device.port, device.user, device.password, null, null).then((result) => {
                console.log(`Succsessfully connected to: ${device.id}`);
            }).catch((e) => {
                node.error(`NETCONF Setup Error: ${e}`);
            });
    });

    return devices
}

function updateDatabase(devices) {
    _server.close(() => {
        devices.forEach(device => {
            res = device.session.perform('xget /', parse=false)
            prisma.timeseriesXML.create({
                data: {
                    'deviceName': device.id,
                    'timestamp': new Date(),
                    'xml': res
                }
            }).then((_) => {
                
            })
        });

        _server = app.listen(port, () => {
        
        });
    })
}

easyNetconf.ready().then(() => {
    let devices = createSessions(processNetworks(content));

    setInterval(() => {
        updateDatabase(devices);
    }, pollingInterval);
});

const app = express()
const port = 3000

let _server = app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

app.get('/devices', (req, res) => {
    const devices = processNetworks(content);
    res.json(devices.map(device => ({
        id: device.id,
        server: device.server,
        port: device.port
    })));
});

app.get('/timeseries/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    try {
        const timeSeriesData = await prisma.timeseriesXML.findMany({
            where: { deviceName: deviceId },
            orderBy: { timestamp: 'desc' }
        });
        if (timeSeriesData.length === 0) {
            return res.status(404).json({ error: `No time series data found for device ${deviceId}` });
        }
        res.json(timeSeriesData);
    } catch (error) {
        console.error(`Error fetching time series data for device ${deviceId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});