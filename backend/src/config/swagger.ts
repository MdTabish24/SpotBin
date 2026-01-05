import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'CleanCity API',
    version: '1.0.0',
    description: `
# CleanCity - Smart Waste Management Platform API

Community-driven waste management system that empowers citizens to report waste hotspots 
while enabling municipal authorities and sanitation workers to efficiently manage and resolve waste issues.

## Authentication

- **Citizens**: No authentication required (device fingerprint in X-Device-ID header)
- **Workers**: JWT token in Authorization header (obtained via OTP login)
- **Admins**: JWT token in Authorization header (obtained via email/password login)

## Rate Limiting

- General API: 100 requests per minute per IP
- Authentication endpoints: 10 attempts per 15 minutes per IP
- Report submission: 10 reports per day per device, 5 minute cooldown between reports

## Error Responses

All errors follow a consistent format:
\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "field": "optional_field_name",
    "retryAfter": 60,
    "requestId": "uuid-for-debugging"
  }
}
\`\`\`
    `,
    contact: {
      name: 'CleanCity Support',
      email: 'support@cleancity.in',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  tags: [
    {
      name: 'Reports',
      description: 'Waste report submission and tracking (Citizen)',
    },
    {
      name: 'Leaderboard',
      description: 'Points and rankings (Citizen)',
    },
    {
      name: 'Workers',
      description: 'Worker authentication and task management',
    },
    {
      name: 'Tasks',
      description: 'Task verification and completion (Worker)',
    },
    {
      name: 'Admin',
      description: 'Dashboard, analytics, and management (Admin)',
    },
    {
      name: 'Health',
      description: 'System health checks',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for worker/admin authentication',
      },
      deviceId: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Device-ID',
        description: 'Device fingerprint for citizen identification',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                example: 'Photo size exceeds 5MB limit',
              },
              field: {
                type: 'string',
                example: 'photo',
              },
              retryAfter: {
                type: 'integer',
                example: 60,
              },
              requestId: {
                type: 'string',
                format: 'uuid',
              },
            },
            required: ['code', 'message'],
          },
        },
      },
      Location: {
        type: 'object',
        properties: {
          lat: {
            type: 'number',
            format: 'double',
            minimum: -90,
            maximum: 90,
            example: 19.076,
          },
          lng: {
            type: 'number',
            format: 'double',
            minimum: -180,
            maximum: 180,
            example: 72.8777,
          },
          accuracy: {
            type: 'number',
            format: 'double',
            example: 10,
          },
        },
        required: ['lat', 'lng'],
      },
      ReportStatus: {
        type: 'string',
        enum: ['open', 'assigned', 'in_progress', 'verified', 'resolved'],
      },
      Severity: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
      },
      Report: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          photoUrl: {
            type: 'string',
            format: 'uri',
          },
          location: {
            $ref: '#/components/schemas/Location',
          },
          description: {
            type: 'string',
            maxLength: 50,
          },
          status: {
            $ref: '#/components/schemas/ReportStatus',
          },
          severity: {
            $ref: '#/components/schemas/Severity',
          },
          wasteTypes: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          resolvedAt: {
            type: 'string',
            format: 'date-time',
          },
          pointsAwarded: {
            type: 'integer',
          },
          beforePhotoUrl: {
            type: 'string',
            format: 'uri',
          },
          afterPhotoUrl: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      Badge: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            example: 'Eco Warrior',
          },
          icon: {
            type: 'string',
            example: '🌿',
          },
          requirement: {
            type: 'integer',
            example: 50,
          },
        },
      },
      UserStats: {
        type: 'object',
        properties: {
          totalPoints: {
            type: 'integer',
          },
          currentBadge: {
            $ref: '#/components/schemas/Badge',
          },
          rank: {
            type: 'integer',
          },
          cityRank: {
            type: 'integer',
          },
          areaRank: {
            type: 'integer',
          },
          reportsCount: {
            type: 'integer',
          },
          streakDays: {
            type: 'integer',
          },
        },
      },
      LeaderboardEntry: {
        type: 'object',
        properties: {
          rank: {
            type: 'integer',
          },
          deviceId: {
            type: 'string',
            description: 'Hashed device ID for privacy',
          },
          points: {
            type: 'integer',
          },
          reportsCount: {
            type: 'integer',
          },
          badge: {
            type: 'string',
          },
        },
      },
      Worker: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          phone: {
            type: 'string',
          },
          assignedZones: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          activeTasksCount: {
            type: 'integer',
          },
          completedToday: {
            type: 'integer',
          },
          rating: {
            type: 'number',
          },
        },
      },
      Task: {
        type: 'object',
        properties: {
          reportId: {
            type: 'string',
            format: 'uuid',
          },
          location: {
            $ref: '#/components/schemas/Location',
          },
          severity: {
            $ref: '#/components/schemas/Severity',
          },
          wasteType: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          reportedAt: {
            type: 'string',
            format: 'date-time',
          },
          distance: {
            type: 'number',
            description: 'Distance from worker in meters',
          },
          estimatedTime: {
            type: 'integer',
            description: 'Estimated time in minutes',
          },
          status: {
            $ref: '#/components/schemas/ReportStatus',
          },
          photoUrl: {
            type: 'string',
            format: 'uri',
          },
          description: {
            type: 'string',
          },
        },
      },
      DashboardStats: {
        type: 'object',
        properties: {
          totalReports: {
            type: 'integer',
          },
          openReports: {
            type: 'integer',
          },
          inProgressReports: {
            type: 'integer',
          },
          resolvedToday: {
            type: 'integer',
          },
          avgResolutionTime: {
            type: 'number',
            description: 'Average resolution time in hours',
          },
          topContributors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                deviceId: {
                  type: 'string',
                },
                points: {
                  type: 'integer',
                },
                reportsCount: {
                  type: 'integer',
                },
              },
            },
          },
          areaWiseBreakdown: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                areaName: {
                  type: 'string',
                },
                totalReports: {
                  type: 'integer',
                },
                resolvedPercentage: {
                  type: 'number',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad Request - Invalid input',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized - Invalid or missing authentication',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      NotFound: {
        description: 'Not Found - Resource does not exist',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      TooManyRequests: {
        description: 'Too Many Requests - Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
    },
  },
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/index.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'CleanCity API Documentation',
    })
  );

  // JSON spec endpoint
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

export default swaggerSpec;
