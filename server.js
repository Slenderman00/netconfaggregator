const express = require('express')

const processNetworks = require('./processNetworks.js')

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const xpath = require('xpath');
const dom = require('xmldom').DOMParser;

const path = require('path');
const fs = require('fs');

const { XMLParser } = require("fast-xml-parser");
const parser = new XMLParser();

const app = express()
const port = 3001

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const filePath = process.argv[2] || path.join(__dirname, 'networks.xml');
let content = fs.readFileSync(filePath, 'utf8');
content = parser.parse(content);

let _server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

app.get('/devices', (req, res) => {
    const devices = processNetworks(content);
    res.json(devices.map(device => ({
        id: device.id,
        server: device.server,
        port: device.port
    })));
});


app.post('/timeseries/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const { xpathQuery, from, to } = req.body;
    console.log(xpathQuery, from, to)
    try {
        const timeSeriesData = await prisma.timeseriesXML.findMany({
            where: { deviceName: deviceId,
                timestamp: {
                    gte: new Date(from),
                    lte: new Date(to)
                }
            },
            orderBy: { timestamp: 'desc' }
        });
        if (timeSeriesData.length === 0) {
            return res.status(404).json({ error: `No time series data found for device ${deviceId}` });
        }

        let filteredData = timeSeriesData;
        if (xpathQuery) {
            console.log(xpathQuery)
            filteredData = timeSeriesData.map(entry => {
                const doc = new dom().parseFromString(entry.xml);
                const nodes = xpath.select(xpathQuery, doc);
                entry.xml = nodes.map(node => node.toString()).join();
                return entry;
            });
        }
        res.json(filteredData);
    } catch (error) {
        console.error(`Error fetching time series data for device ${deviceId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});