
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { fileId } = body

        if (!fileId) {
            return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
        }

        // Fetch file info
        const { data: file, error: fileError } = await supabaseAdmin
            .from('files')
            .select('*')
            .eq('id', fileId)
            .single()

        if (fileError || !file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        // Fetch annotations
        const { data: annotations, error: annError } = await supabaseAdmin
            .from('annotations')
            .select('*')
            .eq('file_id', fileId)
            .order('created_at', { ascending: true })

        if (annError) {
            return NextResponse.json({ error: annError.message }, { status: 500 })
        }

        // Fetch activity logs
        const { data: activityLogs, error: actError } = await supabaseAdmin
            .from('activity_logs')
            .select('*')
            .eq('file_id', fileId)
            .order('created_at', { ascending: true })

        if (actError) {
            return NextResponse.json({ error: actError.message }, { status: 500 })
        }

        // Generate HTML for PDF
        const html = generateReportHtml(file, annotations || [], activityLogs || [])

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html'
            }
        })

    } catch (e: any) {
        console.error('Report Export API Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

function generateReportHtml(file: any, annotations: any[], activityLogs: any[]): string {
    const formatDate = (date: string) => new Date(date).toLocaleString()
    const formatPosition = (pos: any) => {
        if (typeof pos === 'object') {
            if ('page' in pos) return `Page ${pos.page}, (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`
            if ('x' in pos && 'y' in pos && 'z' in pos) return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`
        }
        return JSON.stringify(pos)
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Export Report - ${file.name}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
            line-height: 1.6;
        }
        .header {
            border-bottom: 3px solid #4F46E5;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        h1 {
            color: #4F46E5;
            margin: 0 0 10px 0;
        }
        .meta {
            color: #666;
            font-size: 14px;
        }
        .section {
            margin: 30px 0;
        }
        .section h2 {
            color: #1F2937;
            border-bottom: 2px solid #E5E7EB;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th {
            background: #F3F4F6;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #D1D5DB;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #E5E7EB;
        }
        tr:hover {
            background: #F9FAFB;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge-comment { background: #DBEAFE; color: #1E40AF; }
        .badge-bubble { background: #FCE7F3; color: #BE185D; }
        .badge-dimension { background: #FEF3C7; color: #92400E; }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #E5E7EB;
            text-align: center;
            color: #9CA3AF;
            font-size: 12px;
        }
        @media print {
            body { margin: 0; padding: 20px; }
            tr { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📄 Export Report</h1>
        <div class="meta">
            <strong>File:</strong> ${file.name} &nbsp;|&nbsp;
            <strong>Type:</strong> ${file.type} &nbsp;|&nbsp;
            <strong>Version:</strong> ${file.version} &nbsp;|&nbsp;
            <strong>Generated:</strong> ${formatDate(new Date().toISOString())}
        </div>
    </div>

    <div class="section">
        <h2>📌 Annotations (${annotations.length})</h2>
        ${annotations.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Text</th>
                    <th>Position</th>
                    <th>Created At</th>
                </tr>
            </thead>
            <tbody>
                ${annotations.map(ann => `
                <tr>
                    <td><span class="badge badge-${ann.type}">${ann.type}</span></td>
                    <td>${ann.text || '<em>No text</em>'}</td>
                    <td><small>${formatPosition(ann.position)}</small></td>
                    <td>${formatDate(ann.created_at)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : '<p><em>No annotations found.</em></p>'}
    </div>

    <div class="section">
        <h2>📋 Activity Log (${activityLogs.length})</h2>
        ${activityLogs.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>Action</th>
                    <th>User ID</th>
                    <th>Timestamp</th>
                </tr>
            </thead>
            <tbody>
                ${activityLogs.map(log => `
                <tr>
                    <td><strong>${log.action.replace(/_/g, ' ').toUpperCase()}</strong></td>
                    <td><small>${log.user_id || 'Unknown'}</small></td>
                    <td>${formatDate(log.created_at)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : '<p><em>No activity logs found.</em></p>'}
    </div>

    <div class="footer">
        <p>Generated by CAD Viewer Platform • ${formatDate(new Date().toISOString())}</p>
    </div>

    <script>
        // Auto-print when opened
        window.onload = () => {
            setTimeout(() => window.print(), 500);
        };
    </script>
</body>
</html>
    `.trim()
}
