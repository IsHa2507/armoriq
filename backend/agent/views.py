from rest_framework.decorators import api_view
from rest_framework.response import Response

from .policy.policy_engine import evaluate
from .policy.rule_manager import RuleManager

rule_manager = RuleManager()


@api_view(["GET"])
def health(request):
    return Response({
        "status": "ok",
        "message": "ArmorIQ Backend Running"
    })


@api_view(["GET"])
def get_rules(request):
    return Response(rule_manager.get_rules())


@api_view(["POST"])
def chat(request):

    tool = request.data.get("tool")

    result = evaluate(tool)

    return Response(result)