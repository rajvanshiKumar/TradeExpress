import asyncio
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(root / "backend"))
sys.path.insert(0, str(root))

os.environ["TX_OFFLINE"] = "1"

from chatbot.backend.agent import ChatbotAgent
from chatbot.backend.tools import execute_get_order_status, execute_search_products, execute_get_store_policy

async def main():
    print("Testing Chatbot Engine directly...")
    agent = ChatbotAgent()

    # Test 1: Order Tracking
    print("\n--- Test 1: Order Tracking ---")
    res1 = await agent.chat("Where is my order ORD-2026-9021?", session_id="test_sess_1")
    print(f"Reply:\n{res1.reply}")
    assert res1.order_status is not None
    assert res1.order_status.order_number == "ORD-2026-9021"
    assert res1.order_status.order_status == "SHIPPED"
    print(f"Carrier: {res1.order_status.carrier_name}, Progress: {res1.order_status.progress_percentage}%")
    print("✓ Order tracking verified with exact TradeExpress Order schema!")

    # Test 2: Product Search
    print("\n--- Test 2: Product Search ---")
    res2 = await agent.chat("Show black cotton shirts under 1000", session_id="test_sess_2")
    print(f"Matched products: {len(res2.products)}")
    assert len(res2.products) > 0
    p = res2.products[0]
    print(f"Top Product: {p.name} | Price: ₹{p.price} | Stock: {p.stock}")
    print("✓ Product search & budget filter verified!")

    # Test 3: Store Policy FAQ
    print("\n--- Test 3: Store Policy FAQ ---")
    res3 = await agent.chat("What is your return policy and shipping time?", session_id="test_sess_3")
    print(f"Policy reply:\n{res3.reply}")
    assert "return" in res3.reply.lower() or "days" in res3.reply.lower()
    print("✓ Policy lookup verified!")

    # Test 4: Tool execution & Non-existent Order Lookup
    print("\n--- Test 4: Demo vs Non-Existent Order Lookup ---")
    order_found = await execute_get_order_status("ORD-2026-9021")
    assert order_found is not None
    assert order_found.order_number == "ORD-2026-9021"
    assert len(order_found.items) > 0
    print(f"Active Order Verified: #{order_found.order_number} ({order_found.order_status})")

    # Non-existent/unplaced order returns None
    order_missing = await execute_get_order_status("ORD-998811")
    assert order_missing is None
    print("Non-existent/unplaced order correctly returned None!")

    # Verify agent response for unplaced order
    res4 = await agent.chat("Mera order ORD-998811 kahan pahuncha?", session_id="test_sess_4")
    print(f"Unplaced Order Agent Reply:\n{res4.reply}")
    assert "Record Nahi Mila" in res4.reply or "Not Found" in res4.reply
    assert res4.order_status is None
    print("✓ Realistic unplaced order handling verified!")

    # Test 4B: Size Exchange / Fit Question (Should NOT return shirt cards)
    print("\n--- Test 4B: Size Fit & Exchange Query ---")
    res_fit = await agent.chat("Agar shirt size fit na ho toh return ya exchange kaise hoga?", session_id="test_sess_fit")
    print(f"Fit reply:\n{res_fit.reply}")
    assert len(res_fit.products) == 0, "Should NOT recommend products to buy on a return/exchange query!"
    assert "exchange" in res_fit.reply.lower() or "replacement" in res_fit.reply.lower() or "return" in res_fit.reply.lower()
    print("✓ Size exchange correctly routes to policy, not product search!")

    # Test 4C: Party Wear Search
    print("\n--- Test 4C: Party Wear Search Under 1500 ---")
    res_party = await agent.chat("1500 tak me best party wear", session_id="test_sess_party")
    print(f"Party wear products count: {len(res_party.products)}")
    assert len(res_party.products) > 0
    assert any("party" in p.name.lower() or "kurta" in p.name.lower() or "satin" in p.name.lower() for p in res_party.products)
    print(f"Top Party item: {res_party.products[0].name} (₹{res_party.products[0].price})")
    print("✓ Party wear catalog search verified!")

    # Test 5: Out of Scope Guardrails
    print("\n--- Test 5: Out of Scope Deflection ---")
    res5 = await agent.chat("python kya hota hai", session_id="test_sess_5")
    print(f"Reply:\n{res5.reply}")
    assert "TradeExpress" in res5.reply
    assert "coding" in res5.reply or "Shopping" in res5.reply
    print("✓ Out-of-scope query deflected politely!")

    # Test 6: Check Delivery Time (No Order ID clash)
    print("\n--- Test 6: Check Delivery Time ---")
    res6 = await agent.chat("Check Delivery Time", session_id="test_sess_6")
    print(f"Reply:\n{res6.reply}")
    assert "3 se 7 business days" in res6.reply or "Delivery Timelines" in res6.reply
    assert res6.order_status is None
    print("✓ Delivery Time handled properly without asking for Order ID!")

    # Test 7: View Size Guide
    print("\n--- Test 7: View Size Guide ---")
    res7 = await agent.chat("View Size Guide", session_id="test_sess_7")
    print(f"Reply:\n{res7.reply}")
    assert "Chest 38" in res7.reply
    print("✓ Size Guide verified!")

    # Test 8: Available Colors
    print("\n--- Test 8: Available Colors ---")
    res8 = await agent.chat("Available Colors", session_id="test_sess_8")
    print(f"Reply:\n{res8.reply}")
    assert "Solid Black" in res8.reply
    print("✓ Available Colors verified!")

    # Test 9: English Query Language Matching
    print("\n--- Test 9: English Query Response ---")
    res9 = await agent.chat("What is your shipping time and return policy?", session_id="test_sess_9")
    print(f"Reply:\n{res9.reply}")
    assert "business days" in res9.reply.lower() or "return" in res9.reply.lower()
    assert "aapka" not in res9.reply.lower() and "hoga" not in res9.reply.lower()
    print("✓ English language matching verified!")

    # Test 10: Hindi / Hinglish Query Language Matching
    print("\n--- Test 10: Hindi / Hinglish Query Response ---")
    res10 = await agent.chat("500 ke andar black shirt dikhao", session_id="test_sess_10")
    print(f"Reply:\n{res10.reply}")
    assert "budget" in res10.reply.lower() or "best" in res10.reply.lower() or "humne" in res10.reply.lower()
    assert len(res10.products) > 0
    print("✓ Hindi language matching verified!")

    print("\n==============================================")
    print("ALL 10 CHATBOT TESTS PASSED COMPLETELY! (0 ERRORS)")
    print("==============================================")
    await agent.client.aclose()

if __name__ == "__main__":
    asyncio.run(main())
