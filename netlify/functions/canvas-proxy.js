exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { canvasUrl, canvasToken, courseId, assignmentData, announcementData, assignmentGroupName } = data;
    
    // Determine endpoint content
    let endpoint = '';
    let payload = {};
    
    if (assignmentData) {
        endpoint = `/api/v1/courses/${courseId}/assignments`;
        payload = assignmentData;
        
        // Handle assignment group lookup if provided
        if (assignmentGroupName) {
            try {
                // Fetch groups
                const groupsResp = await fetch(`${canvasUrl}/api/v1/courses/${courseId}/assignment_groups`, {
                    headers: { 'Authorization': `Bearer ${canvasToken}` }
                });
                
                if (groupsResp.ok) {
                    const groups = await groupsResp.json();
                    let groupId = null;
                    
                    // Try exact match
                    const exactGroup = groups.find(g => g.name === assignmentGroupName);
                    if (exactGroup) {
                        groupId = exactGroup.id;
                    } else {
                        // Try case-insensitive match
                        const caseGroup = groups.find(g => g.name.toLowerCase() === assignmentGroupName.toLowerCase());
                        if (caseGroup) groupId = caseGroup.id;
                    }
                    
                    if (groupId) {
                        payload.assignment.assignment_group_id = groupId;
                    }
                }
            } catch (groupError) {
                console.error('Error fetching groups:', groupError);
                // Continue without group ID if fetching fails
            }
        }
    } else if (announcementData) {
        endpoint = `/api/v1/courses/${courseId}/discussion_topics`;
        payload = announcementData;
    } else {
        return { 
            statusCode: 400, 
            headers, 
            body: JSON.stringify({ error: 'Missing assignment or announcement data' }) 
        };
    }

    // Make request to Canvas
    const response = await fetch(`${canvasUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${canvasToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseData;
    try {
        responseData = JSON.parse(responseText);
    } catch (e) {
        responseData = { text: responseText };
    }

    if (!response.ok) {
        return {
            statusCode: response.status,
            headers,
            body: JSON.stringify({ 
                error: responseData || 'Canvas API Error', 
                status: response.status 
            })
        };
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseData)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
