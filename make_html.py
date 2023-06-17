import json
import feedparser
from urllib.parse import urlparse
import hashlib
from datetime import datetime

def generate_html(feed_url):
    # Parse the RSS feed
    feed = feedparser.parse(feed_url)

    # Generate the HTML content
    html_content = '''
        <!doctype html>
        <html lang=en>
        <meta http-equiv=content-type content="text/html;charset=iso-8859-1">
        <meta name=robots content="noindex,nofollow,noarchive">
        <script async src=https://code.jquery.com/jquery-3.6.0.min.js></script>
        <link rel=stylesheet href=style.css>

        <script async src=javacode.js></script>
        <script async src=localstorage.js></script>
        <script>
        function removeEntry(entryId) {
            var entry = document.getElementById(entryId);
            $(entry).fadeTo(200, 0.01, function() {
                $(this).slideUp(150, function() {
                    $(this).remove();
                });
            });
        }
        </script>
	<script>
	    // Open the settings modal dialog box
	    function openSettingsModal() {
        	var modal = document.getElementById("settingsModal");
	        modal.style.display = "block";
	    }

	    // Close the settings modal dialog box
	    function closeSettingsModal() {
	        var modal = document.getElementById("settingsModal");
	        modal.style.display = "none";
	    }
	</script>


        <html>
        <head>
            <title>Latest News</title>
        </head>
        <body id=rawdog>
        <div id="loading-screen">Loading...</div>
            <div id="items">
            <div id="day">
    '''


    # Iterate over the entries in the feed
    for entry in feed.entries:

        # Generate a unique ID based on the entry's summary
        entry_id = hashlib.md5(entry.summary.encode('utf-8')).hexdigest()

        # make pub date more reader friendly
        entry.published = datetime.strptime(entry.published, "%a, %d %b %Y %H:%M:%S %z")
        entry.published = entry.published.strftime("%a, %d %b %Y %I:%M%p")

        # get item url
        url = entry.get('links')
        url = url.replace("'", '"')
        url = json.loads(url)
        url = url[0]
        url = url.get('href')

        # get source domain
        source = urlparse(url)
        source = source.netloc
        
        # output rss item
        html_content += f'''
            <div class="time">
            <div class="item" id="{entry_id}">
            <button type="button" class="close" onclick="removeEntry('{entry_id}')">x</button>
            <div class="itembox">
            

                <div class="pubdate">
                <p>{entry.published}</p>
                </div>
                
                <p class="itemheader"></p>
                
                <div class="itemtitle">
                    <a href="{url}" target="_blank">{entry.title}</a>
                </div>
                
                <div class="itemfrom">
                    <p>Source: {source}</p>
                </div>
                
                <div class="itemdescription">
                    <p>{entry.summary}</p>
                </div>
            </div>
            </div>
            </div>
            '''

    html_content += '''
        </div>
        </div>
	<!-- Cog wheel button -->
<div class="cog-wheel-button" onclick="openSettingsModal()">&#9881;</div>

<!-- Modal dialog box -->
<div id="settingsModal" class="modal">
    <div class="modal-content">
        <h2>Settings</h2>
        <form>
            <label for="rssFeeds">RSS Feeds (one per line):</label><br>
            <textarea id="rssFeeds" name="rssFeeds" rows="5" cols="30"></textarea><br>

            <label for="filterWords">Filter Words (one per line):</label><br>
            <textarea id="filterWords" name="filterWords" rows="5" cols="30"></textarea><br>

            <input type="submit" value="Save">
        </form>
    </div>
</div>

<!-- Add the cog wheel button and modal dialog box HTML structure -->
<div class="cog-wheel-button" onclick="openSettingsModal()">&#9881;</div>

<div id="settingsModal" class="modal">
    <div class="modal-content">
        <h2>Settings</h2>
        <form>
            <label for="rssFeeds">RSS Feeds (one per line):</label><br>
            <textarea id="rssFeeds" name="rssFeeds" rows="5" cols="30"></textarea><br>

            <label for="filterWords">Filter Words (one per line):</label><br>
            <textarea id="filterWords" name="filterWords" rows="5" cols="30"></textarea><br>

            <input type="submit" value="Save">
        </form>
    </div>
</div>

<!-- Add the JavaScript functions to handle the modal dialog box -->
<script>
    // Open the settings modal dialog box
    function openSettingsModal() {
        var modal = document.getElementById("settingsModal");
        modal.style.display = "block";
    }

    // Close the settings modal dialog box
    function closeSettingsModal() {
        var modal = document.getElementById("settingsModal");
        modal.style.display = "none";
    }
</script>
	<button id="scroll-to-top-button">Scroll to Top</button>

        </body>
        </html>
    '''

    return html_content

# Example usage
rss_feed_url = "/tmp/filtered_feed.xml"
html_page_content = generate_html(rss_feed_url)

# Save the generated HTML to a file
with open("www/data/final_feed.html", "w") as file:
    file.write(html_page_content)

