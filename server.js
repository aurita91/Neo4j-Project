const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve static files (your HTML/JS/CSS)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Allow embedding in iframes (for Notion)
app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self' https://www.notion.so");
    next();
});

// Neo4j Aura credentials
const driver = neo4j.driver(
    'neo4j+s://101aef2c.databases.neo4j.io',
    neo4j.auth.basic('neo4j', 'kls96xdNfx5L06-ujQyfe2p6vIr_LUsEktG2meF_ie8')
);

// API endpoint to get graph data
app.get('/graph', async (req, res) => {
    const session = driver.session();
    try {
        const result = await session.run(`
      MATCH (n)-[r]->(m)
      RETURN n,r,m
    `);

        const nodes = {};
        const edges = [];

        result.records.forEach(record => {
            const n = record.get('n');
            const m = record.get('m');
            const r = record.get('r');

            const nId = n.identity.toString();
            const mId = m.identity.toString();
            const rId = r.identity.toString();

            if (!nodes[nId]) {
                nodes[nId] = {
                    data: {
                        id: nId,
                        label: n.properties.name || n.labels.join(','),
                        ...n.properties,
                        type: n.labels[0] || "Node"
                    }
                };
            }

            if (!nodes[mId]) {
                nodes[mId] = {
                    data: {
                        id: mId,
                        label: m.properties.name || m.labels.join(','),
                        ...m.properties,
                        type: m.labels[0] || "Node"
                    }
                };
            }

            edges.push({
                data: {
                    id: rId,
                    source: nId,
                    target: mId,
                    label: r.type
                }
            });
        });

        res.json({ nodes: Object.values(nodes), edges });

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    } finally {
        await session.close();
    }
});

// Close Neo4j driver on exit
process.on('exit', async () => {
    await driver.close();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
