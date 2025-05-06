const easyNetconf = require('./easynetconf-cjs');

const processNetworks = require('./processNetworks.js')

const dotenv = require('dotenv');
dotenv.config();

const path = require('path');
const fs = require('fs');

const { XMLParser } = require("fast-xml-parser");
const parser = new XMLParser();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const filePath = process.argv[2] || path.join(__dirname, 'networks.xml');
const postgresUrl = process.argv[3] || process.env.DATABASE_URL;
const pollingInterval = process.argv[4] || 100000;

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

function createSessions(devices) {
    devices.forEach(device => {
        session = new easyNetconf()
        device.session = session

        session.async_connect(device.server, device.port, device.user, device.password, null, null).then((result) => {
                console.log(`Succsessfully connected to: ${device.id}`);
            }).catch((e) => {
                console.error(`NETCONF Setup Error: ${e}`);
            });
    });

    return devices
}

function maintainSessions(devices) {
    devices.forEach(device => {
        session = device.session
        session.async_connect(device.server, device.port, device.user, device.password, null, null).then((result) => {
                console.log(`Succsessfully connected to: ${device.id}`);
            }).catch((e) => {
                console.error(`NETCONF Setup Error: ${e}`);
            });
    });
}

function updateDatabase(devices) {
    devices.forEach(device => {

        try {
            res = device.session.perform('xget /', parse=false)
        } catch {
            device.session.connected = false;
        }

        prisma.timeseriesXML.create({
            data: {
                'deviceName': device.id,
                'timestamp': new Date(),
                'xml': res
            }
        }).then((_) => {
            
        })
    });
}

easyNetconf.ready().then(() => {
    let devices = createSessions(processNetworks(content));

    setInterval(() => {
        maintainSessions(devices)
    }, 60);

    setInterval(() => {
        updateDatabase(devices);
    }, pollingInterval);
});