require("dotenv").config();
const path = process.env.PATH_TO_METADATA_FILE;
const localEventUrl = process.env.LOCAL_EVENT_LISTENER_URL;
const startMonitoring = require("./monitor");

startMonitoring(path, localEventUrl);
