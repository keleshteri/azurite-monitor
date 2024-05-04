const axios = require("axios");
const chokidar = require("chokidar");
const fs = require("fs");

/**
 *  Create a Service Bus message from a blob object.
 * @param {*} blob
 * @returns
 */
function createServiceBusMessage(blob) {
  return {
    body: {
      topic: "local-topic",
      subject: `blobServices/default/containers/${blob.containerName}/blobs/${blob.name}`,
      eventType: "Microsoft.Storage.BlobCreated",
      id: blob.$loki,
      data: {
        api: "PutBlob",
        clientRequestId: "local-client-request-id",
        requestId: "local-request-id",
        eTag: blob.properties.eTag,
        contentType: blob.properties.contentType,
        contentLength: blob.properties.contentLength,
        blobType: blob.properties.blobType,
        //blob.core.windows.net
        blobUrl: `https://devstoreaccount1.blob.core.windows.net/${blob.containerName}/${blob.name}`,
        url: `https://devstoreaccount1.blob.core.windows.net/${blob.containerName}/${blob.name}`,
        // blobUrl: `https://pmatedemostorage.localhost.local/${blob.containerName}/${blob.name}`,
        // url: `https://pmatedemostorage.localhost.local/${blob.containerName}/${blob.name}`,
        sequencer: "00000000000000000000000000000000",
        identity: "$superuser",
      },
      dataVersion: "",
      metadataVersion: "1",
      eventTime: new Date().toISOString(),
    },
  };
}

function validateInputs(path, localEventUrl) {
  if (!path) {
    throw new Error("The metadata file path must be provided.");
  }
  //check if the path is valid
  if (!fs.existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  if (!localEventUrl) {
    throw new Error("The local event listener URL must be provided.");
  }
}
/**
 * Start monitoring the metadata file for changes and send the latest blob to the local event listener.
 */
function startMonitoring(path, localEventUrl, blobContainerName) {
  try {
    validateInputs(path, localEventUrl);
    const watcher = chokidar.watch(path, { persistent: true });
    watcher.on("change", () => {
      console.log(`Detected change in metadata file: ${path}`);
      fs.readFile(path, (err, data) => {
        if (err) {
          console.error("Failed to read file:", err);
          return;
        }
        try {
          const json = JSON.parse(data);
          
          const blobs = json.collections.find(
            (c) => c.name === "$BLOBS_COLLECTION$"
          ).data;

          blobs.sort(
            (a, b) =>
              new Date(b.properties.lastModified) -
              new Date(a.properties.lastModified)
          );

          if (blobs.length > 0) {
            const latestBlob = blobs[0];
            //check if the blob container name is provided
            if (
              blobContainerName &&
              latestBlob.containerName !== blobContainerName
            ) {
              return;
            }
            const message = createServiceBusMessage(latestBlob);
            console.log(latestBlob);
            console.log("Sending message to local event listener...");
            console.log(JSON.stringify(message, null, 2));
            console.log(`Latest Blob Name: ${latestBlob.name}`);
            console.log(`Creation Time: ${latestBlob.properties.creationTime}`);
            console.log(`Last Modified: ${latestBlob.properties.lastModified}`);
            console.log(
              `Content Length: ${latestBlob.properties.contentLength}`
            );
            console.log(`Blob Type: ${latestBlob.properties.blobType}`);
            axios
              .post(localEventUrl, message)
              .then((response) =>
                console.log("Event sent successfully:", response.data)
              )
              .catch((error) => console.error("Error sending event:", error));
          } else {
            console.log("No blobs found.");
          }
        } catch (parseError) {
          console.error("Error parsing JSON:", parseError);
        }
      });
    });
    console.log(`Watching for changes in: ${path}`);
  } catch (error) {
    console.error("Error starting monitoring:", error.message);
  }
}

module.exports = startMonitoring;
