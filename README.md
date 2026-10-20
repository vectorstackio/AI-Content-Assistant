AI Content Assistant

A Next.js application that allows users to submit web content and ask questions about it using AI.

The project demonstrates how to build an AI-powered application using React, Next.js, TypeScript and the OpenAI API, with an emphasis on clean component architecture, asynchronous processing, streaming responses and automated testing.

Features

URL ingestion — Submit a URL for processing by the backend.

AI-powered questions — Ask questions about ingested content.

Streaming responses — Display AI-generated answers progressively as they arrive.

Conversation history — Retrieve and display previous questions and answers.

Markdown rendering — Format AI-generated answers for readability.

Error handling — Handle validation errors, API failures and unsuccessful requests.

User types — Support student, teacher and tutor content categories.

Automated testing — Unit and component tests using Vitest and React Testing Library.

Continuous integration — GitHub Actions automatically runs tests, linting, TypeScript checks and production builds.

Technology Stack

Technology

Purpose

Next.js

React framework and application routing

React

User interface

TypeScript

Type safety

Tailwind CSS

Styling

OpenAI API

AI-powered question answering through the backend

Vitest

Unit and integration testing

React Testing Library

React component testing

GitHub Actions

Continuous integration

Architecture

The application separates presentation, page-level orchestration and API communication.

src/
├── app/
│   ├── page.tsx
│   └── ingest/
│       └── page.tsx
├── components/
│   ├── query/
│   │   ├── Conversation.tsx
│   │   ├── ConversationPiece.tsx
│   │   ├── QuestionForm.tsx
│   │   └── StreamingAnswer.tsx
│   └── ingest/
│       └── IngestForm.tsx
├── lib/
│   ├── query/
│   ├── ingest/
│   └── common/
└── tests/
    ├── app/
    ├── components/
    └── lib/

Application pages manage state, user interactions and API calls.

React components handle presentation and are designed to be independently testable.

Library modules encapsulate communication with backend services.

Tests are maintained separately from production code, mirroring the application structure.

Getting Started

Prerequisites

Node.js 24

npm

Access to the application's backend API

Installation

Clone the repository:

git clone https://github.com/vectorstackio/hubaicli.git
cd hubaicli
npm ci

Configure any required environment variables for your backend connection.

Start the development server:

npm run dev

Open http://localhost:3000.

Testing

The project uses Vitest and React Testing Library to test components, application pages and API communication.

Run the test suite:

npm run test:run

Generate a coverage report:

npm run test:coverage

The HTML coverage report can be viewed at:

coverage/index.html

The test suite covers:

Form validation and submission

Conversation history

Streaming responses

Successful and unsuccessful API requests

Loading and error states

Ingestion requests

React component behaviour

Code Quality

Run ESLint:

npm run lint

Check TypeScript:

npx tsc --noEmit

Build the production application:

npm run build

Continuous Integration

The repository includes a GitHub Actions workflow that runs automatically on pushes and pull requests.

The workflow performs:

Dependency installation

Automated tests and coverage

TypeScript validation

ESLint checks

Production build

This helps identify regressions and ensures code quality checks are consistently applied.

Project Scope

This repository contains the Next.js frontend for the AI content ingestion and question-answering application.

The backend services responsible for content processing and AI integration are separate from the frontend application.

Author

Michael Garthwaite

Senior Full-Stack Developer & Technical Lead
