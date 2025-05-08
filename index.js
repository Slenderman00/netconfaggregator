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
const pollingInterval = process.argv[4] || 10000;

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

async function createSessions(devices) {
    for (const device of devices) {
        const session = new easyNetconf();
        device.session = session;
        try {
            await session.async_connect(device.server, device.port, device.user, device.password, null, null);
            console.log(`Successfully connected to: ${device.id}`);
        } catch (e) {
            console.error(`NETCONF Setup Error: ${e}`);
        }
    }
    return devices;
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
            console.log("fetching data from: " + device.id)
            res = device.session.perform('xget /', parse=false)
        } catch {
            console.log("fetching data failed, marking device as inactive")
            device.session.connected = false;
        }

        prisma.timeseriesXML.create({
            data: {
                'deviceName': device.id,
                'timestamp': new Date(),
                'xml': res
            }
        }).then((_) => {
            console.log("Successfully added data to database")
        })
    });
}

easyNetconf.ready().then(async () => {
    let devices = await createSessions(processNetworks(content));
    setTimeout(() => {
        setInterval(() => {
            maintainSessions(devices);
        }, 60);
        setInterval(() => {
            updateDatabase(devices);
        }, pollingInterval);
    }, 30);
});
