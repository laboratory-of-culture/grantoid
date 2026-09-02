-- Add PADDING to FindingCategory: the reviewer's rule pass now flags the
-- Ukrainian AI-writing shapes described in the humanizer skill (a significance
-- claim bolted onto a fact, an evaluative дієприслівниковий зворот at a
-- sentence's end).
ALTER TYPE "FindingCategory" ADD VALUE 'PADDING';
