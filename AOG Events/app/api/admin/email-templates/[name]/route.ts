import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { DEFAULT_TEMPLATES, TEMPLATE_NAMES, TemplateName } from "@/lib/email-defaults";

type Params = { params: Promise<{ name: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { name } = await params;
  if (!TEMPLATE_NAMES.includes(name as TemplateName)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  try {
    const template = await prisma.emailTemplate.upsert({
      where: { id: name },
      update: {},
      create: { id: name, ...DEFAULT_TEMPLATES[name as TemplateName] },
    });
    return NextResponse.json(template);
  } catch (error) {
    console.error("Email template GET error:", error);
    return NextResponse.json({ error: "Failed to load template" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  const { name } = await params;
  if (!TEMPLATE_NAMES.includes(name as TemplateName)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { subject, preHeading, heading, bodyHtml, ctaText, ctaUrl, closingHtml } = body;

    const template = await prisma.emailTemplate.upsert({
      where: { id: name },
      update: { subject, preHeading, heading, bodyHtml, ctaText, ctaUrl, closingHtml },
      create: {
        id: name,
        subject,
        preHeading: preHeading ?? "",
        heading: heading ?? "",
        bodyHtml: bodyHtml ?? "",
        ctaText: ctaText ?? "",
        ctaUrl: ctaUrl ?? "",
        closingHtml: closingHtml ?? "",
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Email template PUT error:", error);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { name } = await params;
  if (!TEMPLATE_NAMES.includes(name as TemplateName)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  try {
    // Reset to default by overwriting with the default content
    const defaults = DEFAULT_TEMPLATES[name as TemplateName];
    const template = await prisma.emailTemplate.upsert({
      where: { id: name },
      update: { ...defaults },
      create: { id: name, ...defaults },
    });
    return NextResponse.json(template);
  } catch (error) {
    console.error("Email template DELETE error:", error);
    return NextResponse.json({ error: "Failed to reset template" }, { status: 500 });
  }
}
