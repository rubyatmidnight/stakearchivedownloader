let isCollecting = false;
let collectedUrls = new Set();

function collectUrlsFromPage() {
    const links = document.querySelectorAll('a[href^="https://stake.us/_api/archive/"]');
    links.forEach(link => {
        collectedUrls.add(link.href);
    });
    console.log(`Collected ${links.length} URLs from this page. Total unique URLs: ${collectedUrls.size}`);
}

function goToNextPage() {
    const nextButton = document.querySelector('a[data-test="pagination-next"]');
    if (nextButton) {
        nextButton.click();
        return true;
    }
    return false;
}

async function runCollector() {
    let pageCount = 1;
    
    while (isCollecting) {
        console.log(`Processing page ${pageCount}`);
        collectUrlsFromPage();
        
        const hasNextPage = goToNextPage();
        if (!hasNextPage) {
            console.log("Reached the last page. Collection complete.");
            break;
        }
        
        pageCount++;
        
  
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(isCollecting ? "Collection complete." : "Collection stopped.");
    saveUrlsToFile();
}

function saveUrlsToFile() {
    const urlList = Array.from(collectedUrls).join('\n');
    const blob = new Blob([urlList], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'archive_urls.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log(`Saved ${collectedUrls.size} URLs to archive_urls.txt`);
}


function startCollector() {
    if (!isCollecting) {
        isCollecting = true;
        collectedUrls.clear(); 
        console.log("Starting URL collector...");
        runCollector().catch(error => console.error("An error occurred:", error));
    } else {
        console.log("Collector is already running.");
    }
}


function stopCollector() {
    if (isCollecting) {
        isCollecting = false;
        console.log("Stopping collector...");
    } else {
        console.log("Collector is not running.");
    }
}


console.log("To start collecting URLs, type: startCollector()");
console.log("To stop collecting at any time, type: stopCollector()");
console.log("URLs will be automatically saved to a file when collection is complete or stopped.");
