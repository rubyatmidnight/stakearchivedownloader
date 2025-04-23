let isDownloading = false;

function formatDateForFilename(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                resolve();
            })
            .catch(error => {
                console.error(`Failed to download ${url}:`, error);
                reject(error);
            });
    });
}

async function processCurrentPage() {
    const rows = Array.from(document.querySelectorAll('.table-cell-item'));
    
    for (let i = 0; i < rows.length; i += 2) {
        if (!isDownloading) break;
        
        const dateElement = rows[i].querySelector('.weight-semibold');
        const linkElement = rows[i + 1].querySelector('a[href^="https://stake.us/_api/archive/"]');
        
        if (dateElement && linkElement) {
            const dateString = dateElement.textContent.trim();
            const url = linkElement.href;
            const formattedDate = formatDateForFilename(dateString);
            const filename = `archive_${formattedDate}.json`;
            
            console.log(`Downloading: ${filename}`);
            await downloadFile(url, filename);
            
            // time in ms between downloads
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

function gotoNext() {
    const nextButton = document.querySelector('a[data-test="pagination-next"]');
    if (nextButton) {
        nextButton.click();
        return true;
    }
    return false;
}

async function runDownloader() {
    let pageCount = 1;
    
    while (isDownloading) {
        console.log(`Processing page ${pageCount}`);
        await processCurrentPage();
        
        if (!isDownloading) break; 
        
        const hasNextPage = gotoNext
    ();
        if (!hasNextPage) {
            console.log("Reached the last page. Download complete.");
            break;
        }
        
        pageCount++;
        
        // time in ms before moving to next page 
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(isDownloading ? "Download complete." : "Download stopped.");
}

// start command
function startDownloader() {
    if (!isDownloading) {
        isDownloading = true;
        console.log("Starting downloader...");
        runDownloader().catch(error => console.error("An error occurred:", error));
    } else {
        console.log("Downloader is already running.");
    }
}

// stop command
function stopDownloader() {
    if (isDownloading) {
        isDownloading = false;
        console.log("Stopping downloader...");
    } else {
        console.log("Downloader is not running.");
    }
}

console.log("To start downloading, clear the console again, and type: startDownloader(), then run it");
console.log("To stop downloading at any time, type in the same way: stopDownloader()");
