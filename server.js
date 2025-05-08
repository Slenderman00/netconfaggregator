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
const port = 3002

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

const simpleHash = str => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
    }
    return (hash >>> 0).toString(36).padStart(7, '0');
};

hashlist = {}
processingque = {}

const processDate = (date) => {
    let d = new Date(date);

    let datetext = d.toTimeString();
    datetext = datetext.split(' ')[0];
    datetext = datetext.split(':');
    return `${datetext[0]}:${datetext[1]}`
}

const getHashData = (device, xpathQuery, from, to) => {
    from = processDate(from)
    to = processDate(to)

    let hash = simpleHash(`${device}${xpathQuery}${from}${to}`);
    if(hash in hashlist) {
        return hashlist[hash];
    }
    return false
}

const setHashData = (device, xpathQuery, from, to, data) => {
    from = processDate(from)
    to = processDate(to)

    let hash = simpleHash(`${device}${xpathQuery}${from}${to}`);
    hashlist[hash] = data;
}

const addToProcessingQue = (device, xpathQuery, from, to) => {
    from = processDate(from)
    to = processDate(to)

    let hash = simpleHash(`${device}${xpathQuery}${from}${to}`);

    processingque[hash] = true;

    setTimeout(() => {
        if(hash in processingque) {
            delete processingque[hash];
        }
    }, 60 * 1000);
}

const removeFromProcessingQue = (device, xpathQuery, from, to) => {
    from = processDate(from)
    to = processDate(to)

    let hash = simpleHash(`${device}${xpathQuery}${from}${to}`);

    if(hash in processingque) {
        delete processingque[hash];
        console.log(`${xpathQuery} timed out, removing from que`);
    }
}

const ifProcessing = (device, xpathQuery, from, to) => {
    from = processDate(from)
    to = processDate(to)

    let hash = simpleHash(`${device}${xpathQuery}${from}${to}`);
    
    if(hash in processingque) {
        return true
    }

    return false
}

setInterval(() => {
    hashlist = {};
    console.log('cleared cache')
}, 60 * 1000 * 3);

const waitForProcessingToFinish = (device, xpathQuery, from, to) => {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if (!ifProcessing(device, xpathQuery, from, to)) {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
};

const randomDelay = (min = 10, max = 100) => {
    return new Promise((resolve) => {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        setTimeout(resolve, delay);
    });
};

app.post('/timeseries/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const { xpathQuery, from, to } = req.body;
    console.log(xpathQuery, from, to)

    await randomDelay(0, 1000);
    await waitForProcessingToFinish(deviceId, xpathQuery, from, to);

    let hashdata = getHashData(deviceId, xpathQuery, from, to)
    if(hashdata) {
        console.log('found response in cache');
        res.json(hashdata)
        return
    }
    
    addToProcessingQue(deviceId, xpathQuery, from, to);
    console.log('adding to processing que');

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
            filteredData = timeSeriesData.map(entry => {
                const doc = new dom().parseFromString(entry.xml);
                const nodes = xpath.select(xpathQuery, doc);
                entry.xml = nodes.map(node => node.toString()).join();
                return entry;
            });
        }

        setHashData(deviceId, xpathQuery, from, to, filteredData)
        removeFromProcessingQue(deviceId, xpathQuery, from, to);
        console.log('processed and cached');
        res.json(filteredData);
    } catch (error) {
        console.error(`Error fetching time series data for device ${deviceId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});